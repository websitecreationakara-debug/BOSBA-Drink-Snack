import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocialSettings, saveSocialSettings } from "@/data/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SocialSettings } from "@/types";

export const Route = createFileRoute("/admin/social/connections")({
  component: SocialConnectionsAdmin,
});

const empty: Omit<SocialSettings, "updated_at"> = {
  facebook_page_id: "",
  facebook_page_access_token: "",
  instagram_business_account_id: "",
  telegram_bot_token: "",
  telegram_channel_id: "",
  tiktok_access_token: "",
  tiktok_post_visibility: "private",
};

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <CheckCircle2 className="size-3.5" /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Circle className="size-3.5" /> Not connected
    </span>
  );
}

function SocialConnectionsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["social_settings"],
    queryFn: () => getSocialSettings() as Promise<SocialSettings>,
  });
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSocialSettings({ data: form });
      toast.success("Connections saved");
      qc.invalidateQueries({ queryKey: ["social_settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display font-bold text-3xl">Social Connections</h1>
        <p className="text-muted-foreground mt-1">
          Connect each platform here yourself — once saved, Social Posts can publish to it. No
          developer needed.
        </p>
      </div>

      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Facebook &amp; Instagram</h2>
          <div className="flex items-center gap-3">
            <StatusPill connected={!!(form.facebook_page_id && form.facebook_page_access_token)} />
            <StatusPill connected={!!form.instagram_business_account_id} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Create an app at{" "}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            developers.facebook.com/apps
          </a>
          , generate a Page access token with the pages_manage_posts, pages_read_engagement,
          instagram_basic, and instagram_content_publish permissions. The same token is used for
          both platforms below.
        </p>
        <div className="space-y-1.5">
          <Label>Facebook Page ID</Label>
          <Input
            value={form.facebook_page_id}
            onChange={(e) => set("facebook_page_id", e.target.value)}
            placeholder="117135683487442"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Facebook Page Access Token</Label>
          <Input
            type="password"
            value={form.facebook_page_access_token}
            onChange={(e) => set("facebook_page_access_token", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Instagram Business Account ID</Label>
          <p className="text-xs text-muted-foreground">
            The Instagram account must be a Business/Creator account linked to the Facebook Page
            above. Find it by opening
            graph.facebook.com/&#123;page-id&#125;?fields=instagram_business_account&amp;access_token=&#123;token&#125;
            in a browser.
          </p>
          <Input
            value={form.instagram_business_account_id}
            onChange={(e) => set("instagram_business_account_id", e.target.value)}
            placeholder="17841450355133761"
          />
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Telegram</h2>
          <StatusPill connected={!!(form.telegram_bot_token && form.telegram_channel_id)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Message @BotFather on Telegram to create a bot and get its token, then add the bot as an
          admin of your channel.
        </p>
        <div className="space-y-1.5">
          <Label>Bot Token</Label>
          <Input
            type="password"
            value={form.telegram_bot_token}
            onChange={(e) => set("telegram_bot_token", e.target.value)}
            placeholder="123456:ABC-DEF..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Channel ID</Label>
          <p className="text-xs text-muted-foreground">
            Either @yourchannelname (if public) or the numeric ID (starts with -100).
          </p>
          <Input
            value={form.telegram_channel_id}
            onChange={(e) => set("telegram_channel_id", e.target.value)}
            placeholder="@bosbadrinksnack"
          />
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">TikTok</h2>
          <StatusPill connected={!!form.tiktok_access_token} />
        </div>
        <p className="text-xs text-muted-foreground">
          Requires a TikTok developer app with the Content Posting API product, approved by TikTok.
          Until the app is approved, posts publish as private (only visible to you).
        </p>
        <div className="space-y-1.5">
          <Label>Access Token</Label>
          <Input
            type="password"
            value={form.tiktok_access_token}
            onChange={(e) => set("tiktok_access_token", e.target.value)}
            placeholder="act..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Post visibility</Label>
          <Select
            value={form.tiktok_post_visibility}
            onValueChange={(v) => set("tiktok_post_visibility", v as "private" | "public")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private (only me) — use until approved</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
        Save connections
      </Button>
    </div>
  );
}
