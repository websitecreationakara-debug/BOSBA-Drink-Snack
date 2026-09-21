import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  social_settings,
  social_posts,
  social_post_targets,
  products,
  product_tabs,
} from "@/db/schema";
import type { SocialPlatform, SocialSettings } from "@/types";
import { requireSocial } from "./_auth";
import { absoluteMediaUrl, SITE } from "@/lib/integrations/social/shared";
import { slugify } from "@/lib/utils";
import { facebookPublish } from "@/lib/integrations/social/facebook";
import { instagramPublish } from "@/lib/integrations/social/instagram";
import { telegramPublish } from "@/lib/integrations/social/telegram";
import { tiktokPublish, type TiktokVisibility } from "@/lib/integrations/social/tiktok";

// ---- Settings (hand-pasted credentials, no OAuth) -----------------------

// Fixed id so there's always at most one row -- see socialSettingsRow.
const SETTINGS_ID = "default";

type SettingsRow = typeof social_settings.$inferSelect;

async function socialSettingsRow(): Promise<SettingsRow | null> {
  const [row] = await getDb()
    .select()
    .from(social_settings)
    .where(eq(social_settings.id, SETTINGS_ID));
  return row ?? null;
}

// A platform is "connected" when the fields it needs to publish are set --
// there's no separate connect step to persist a boolean for.
function configuredPlatforms(row: SettingsRow | null): SocialPlatform[] {
  if (!row) return [];
  const out: SocialPlatform[] = [];
  if (row.facebook_page_id && row.facebook_page_access_token) out.push("facebook");
  if (row.instagram_business_account_id && row.facebook_page_access_token) out.push("instagram");
  if (row.telegram_bot_token && row.telegram_channel_id) out.push("telegram");
  if (row.tiktok_access_token) out.push("tiktok");
  return out;
}

export const getSocialSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SocialSettings> => {
    await requireSocial();
    const row = await socialSettingsRow();
    return {
      facebook_page_id: row?.facebook_page_id ?? "",
      facebook_page_access_token: row?.facebook_page_access_token ?? "",
      instagram_business_account_id: row?.instagram_business_account_id ?? "",
      telegram_bot_token: row?.telegram_bot_token ?? "",
      telegram_channel_id: row?.telegram_channel_id ?? "",
      tiktok_access_token: row?.tiktok_access_token ?? "",
      tiktok_post_visibility: row?.tiktok_post_visibility === "public" ? "public" : "private",
      updated_at: row?.updated_at ?? "",
    };
  },
);

export const saveSocialSettings = createServerFn({ method: "POST" })
  .inputValidator((d: Omit<SocialSettings, "updated_at">) => d)
  .handler(async ({ data }) => {
    await requireSocial();
    const values = {
      id: SETTINGS_ID,
      facebook_page_id: data.facebook_page_id.trim() || null,
      facebook_page_access_token: data.facebook_page_access_token.trim() || null,
      instagram_business_account_id: data.instagram_business_account_id.trim() || null,
      telegram_bot_token: data.telegram_bot_token.trim() || null,
      telegram_channel_id: data.telegram_channel_id.trim() || null,
      tiktok_access_token: data.tiktok_access_token.trim() || null,
      tiktok_post_visibility: data.tiktok_post_visibility === "public" ? "public" : "private",
      updated_at: new Date().toISOString(),
    };
    await getDb()
      .insert(social_settings)
      .values(values)
      .onConflictDoUpdate({ target: social_settings.id, set: values });
    return { ok: true };
  });

// ---- Posts (pick a product, auto-generate the post, publish hourly) -----

export const listSocialPosts = createServerFn({ method: "GET" }).handler(async () => {
  await requireSocial();
  const db = getDb();
  const [posts, targets] = await Promise.all([
    db.select().from(social_posts).orderBy(desc(social_posts.created_at)),
    db.select().from(social_post_targets).orderBy(asc(social_post_targets.created_at)),
  ]);
  return posts.map((p) => ({
    ...p,
    targets: targets.filter((t) => t.post_id === p.id),
  }));
});

// Builds the caption verbatim from the product's own catalog data -- name,
// description, every tab, and price -- exactly as written, no rewriting, plus
// the admin's optional extra note tacked on at the end.
function buildCaption(
  product: typeof products.$inferSelect,
  tabs: (typeof product_tabs.$inferSelect)[],
  extraNote: string | null,
): string {
  const priceLine =
    product.sale_price != null
      ? `Price: $${product.sale_price.toFixed(2)} (was $${product.price.toFixed(2)})`
      : `Price: $${product.price.toFixed(2)}`;
  const productUrl = `${SITE}/product/${slugify(product.title) || product.id}`;
  return [
    product.title,
    product.description,
    ...tabs.map((t) => `${t.title}\n${t.body}`),
    priceLine,
    extraNote,
    `Shop now: ${productUrl}`,
  ]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join("\n\n");
}

export const queueSocialPost = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      product_id: string;
      image_url: string | null;
      extra_note: string | null;
      scheduled_for: string;
      platforms: SocialPlatform[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const user = await requireSocial();
    const db = getDb();
    const [product] = await db.select().from(products).where(eq(products.id, data.product_id));
    if (!product) throw new Error("Product not found");
    const tabs = await db
      .select()
      .from(product_tabs)
      .where(eq(product_tabs.product_id, product.id))
      .orderBy(asc(product_tabs.sort_order));

    const extraNote = data.extra_note?.trim() || null;
    const [post] = await db
      .insert(social_posts)
      .values({
        product_id: product.id,
        product_title: product.title,
        image_url: data.image_url ?? product.image_url,
        caption: buildCaption(product, tabs, extraNote),
        extra_note: extraNote,
        status: "queued",
        scheduled_for: data.scheduled_for || new Date().toISOString(),
        platforms: data.platforms.length ? data.platforms.join(",") : null,
        created_by: user.id,
      })
      .returning();
    return post;
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireSocial();
    await getDb().delete(social_posts).where(eq(social_posts.id, data.id));
    return { ok: true };
  });

async function publishToPlatform(
  platform: SocialPlatform,
  settings: SettingsRow,
  caption: string,
  mediaUrl: string | null,
): Promise<string> {
  if (platform === "facebook") {
    const { remoteId } = await facebookPublish(
      settings.facebook_page_id!,
      settings.facebook_page_access_token!,
      caption,
      mediaUrl,
    );
    return remoteId;
  }
  if (platform === "instagram") {
    if (!mediaUrl) throw new Error("Instagram requires the product to have an image");
    const { remoteId } = await instagramPublish(
      settings.instagram_business_account_id!,
      settings.facebook_page_access_token!,
      caption,
      mediaUrl,
      "image",
    );
    return remoteId;
  }
  if (platform === "telegram") {
    const { remoteId } = await telegramPublish(
      settings.telegram_bot_token!,
      settings.telegram_channel_id!,
      caption,
      mediaUrl,
      "image",
    );
    return remoteId;
  }
  if (!mediaUrl) throw new Error("TikTok requires the product to have an image");
  const { publishId } = await tiktokPublish(
    settings.tiktok_access_token!,
    caption,
    mediaUrl,
    "image",
    (settings.tiktok_post_visibility === "public" ? "public" : "private") as TiktokVisibility,
  );
  return publishId;
}

export type PublishQueueResult = { published: number; failed: number };

// Publishes every currently "queued" post to each configured platform, then
// marks it "published" (or "failed" if every target failed). Called by the
// hourly Cron Trigger (src/server.ts's `scheduled` handler) and by the
// admin's manual "Publish now" button (publishQueuedSocialPostsNow below).
// Returns how many posts it actually touched, so callers can tell "published"
// apart from "nothing was due yet" instead of assuming success either way.
export async function publishQueuedSocialPosts(): Promise<PublishQueueResult> {
  const db = getDb();
  const settingsRow = await socialSettingsRow();
  const configured = configuredPlatforms(settingsRow);
  if (!settingsRow || configured.length === 0) return { published: 0, failed: 0 };

  const now = new Date().toISOString();
  const queued = await db
    .select()
    .from(social_posts)
    .where(and(eq(social_posts.status, "queued"), lte(social_posts.scheduled_for, now)))
    .orderBy(asc(social_posts.scheduled_for));

  let published = 0;
  let failed = 0;
  for (const post of queued) {
    const mediaUrl = post.image_url ? absoluteMediaUrl(post.image_url) : null;
    // An explicit per-post selection narrows which configured platforms to
    // publish to; none selected (the default) means all of them.
    const selected = post.platforms
      ? (post.platforms.split(",").filter(Boolean) as SocialPlatform[])
      : null;
    const platforms = selected ? configured.filter((p) => selected.includes(p)) : configured;
    let anySuccess = false;
    for (const platform of platforms) {
      try {
        const remoteId = await publishToPlatform(platform, settingsRow, post.caption, mediaUrl);
        await db.insert(social_post_targets).values({
          post_id: post.id,
          platform,
          status: "success",
          remote_post_id: remoteId,
        });
        anySuccess = true;
      } catch (error) {
        await db.insert(social_post_targets).values({
          post_id: post.id,
          platform,
          status: "failed",
          error: error instanceof Error ? error.message : "Publish failed",
        });
      }
    }
    await db
      .update(social_posts)
      .set({ status: anySuccess ? "published" : "failed", published_at: new Date().toISOString() })
      .where(eq(social_posts.id, post.id));
    if (anySuccess) published++;
    else failed++;
  }
  return { published, failed };
}

// Manual trigger so an admin can publish the queue immediately instead of
// waiting for the next hourly tick -- same underlying logic as the Cron Trigger.
export const publishQueuedSocialPostsNow = createServerFn({ method: "POST" }).handler(async () => {
  await requireSocial();
  return await publishQueuedSocialPosts();
});
