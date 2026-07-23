import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { requireManager } from "./_auth";

// D1's hard limit is 2,000,000 bytes per row/BLOB; stay safely under it.
// Large originals are downscaled client-side (src/lib/image.ts) before hitting this.
const MAX_BYTES = 1_900_000;

// Never select the `data` blob when listing — it would pull every image's bytes.
const metaColumns = {
  id: media.id,
  key: media.key,
  url: media.url,
  filename: media.filename,
  content_type: media.content_type,
  size: media.size,
  created_at: media.created_at,
};

export const listMedia = createServerFn({ method: "GET" }).handler(async () => {
  return getDb().select(metaColumns).from(media).orderBy(desc(media.created_at));
});

export const uploadMedia = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Expected multipart form data");
    return d;
  })
  .handler(async ({ data }) => {
    await requireManager();
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
    if (file.size > MAX_BYTES)
      throw new Error("Image is too large even after compression — try a smaller one");

    const dot = file.name.lastIndexOf(".");
    const ext = (dot > 0 ? file.name.slice(dot + 1) : "bin").toLowerCase();
    const slug =
      (dot > 0 ? file.name.slice(0, dot) : file.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "image";
    // Short random suffix keeps the URL readable while guaranteeing uniqueness.
    const key = `${slug}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const url = `/media/${key}`;
    await getDb()
      .insert(media)
      .values({
        key,
        url,
        filename: file.name,
        content_type: file.type,
        size: file.size,
        data: Buffer.from(await file.arrayBuffer()),
      });
    return { url, key };
  });

export const renameMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; filename: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const filename = data.filename.trim();
    if (!filename) throw new Error("Name cannot be empty");
    await getDb().update(media).set({ filename }).where(eq(media.id, data.id));
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    await getDb().delete(media).where(eq(media.id, data.id));
    return { ok: true };
  });
