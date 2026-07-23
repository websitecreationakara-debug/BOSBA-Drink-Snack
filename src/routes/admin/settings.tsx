import { createFileRoute } from "@tanstack/react-router";
import { useStoreSettings } from "@/hooks/use-products";
import { useEffect, useState } from "react";
import { updateSettings } from "@/data/settings";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsAdmin });

function SettingsAdmin() {
  const { data } = useStoreSettings();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    banner_text: "",
    global_discount_pct: "0",
    free_shipping_threshold: "50",
  });

  useEffect(() => {
    if (data)
      setForm({
        banner_text: data.banner_text ?? "",
        global_discount_pct: String(data.global_discount_pct ?? 0),
        free_shipping_threshold: String(data.free_shipping_threshold ?? 50),
      });
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    try {
      await updateSettings({
        data: {
          id: data.id,
          banner_text: form.banner_text,
          global_discount_pct: Number(form.global_discount_pct),
          free_shipping_threshold: Number(form.free_shipping_threshold),
        },
      });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to save settings");
    }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["store_settings"] });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display font-bold text-3xl">Store Settings</h1>
      <form onSubmit={save} className="bg-card border rounded-2xl p-6 space-y-4">
        <div>
          <Label>Promotional Banner Text</Label>
          <Input
            value={form.banner_text}
            onChange={(e) => setForm({ ...form, banner_text: e.target.value })}
            placeholder="e.g. 🎉 Free delivery this weekend — use code SAVE20"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shows as a dismissible bar at the top of the store. Leave blank to hide it. Editing the
            text shows it again to everyone.
          </p>
        </div>
        <div>
          <Label>Global Discount %</Label>
          <Input
            type="number"
            step="0.5"
            value={form.global_discount_pct}
            onChange={(e) => setForm({ ...form, global_discount_pct: e.target.value })}
          />
        </div>
        <div>
          <Label>Free Shipping Threshold ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.free_shipping_threshold}
            onChange={(e) => setForm({ ...form, free_shipping_threshold: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full">
          Save settings
        </Button>
      </form>

      <div className="bg-card border rounded-2xl p-6">
        <h2 className="font-display font-bold mb-2">Make a user admin</h2>
        <p className="text-sm text-muted-foreground">
          Run this in the SQL editor:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded">
            INSERT INTO user_roles (user_id, role) VALUES ('USER_ID', 'admin');
          </code>
        </p>
      </div>
    </div>
  );
}
