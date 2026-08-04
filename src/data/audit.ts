import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./_auth";
import { logAdminAction } from "@/lib/audit";

// Called from admin client pages right after a sensitive better-auth admin
// action succeeds (role change, ban, delete — see src/routes/admin/users.tsx).
// requireAdmin() re-derives the actor's identity server-side from the session,
// so the logged "who" isn't spoofable even though the action/detail strings
// are client-supplied context, same trust model as restore.ts's fileName.
export const recordAdminAction = createServerFn({ method: "POST" })
  .inputValidator((d: { action: string; detail?: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    const user = await requireAdmin();
    await logAdminAction(user, data.action, data.detail);
    return { ok: true };
  });
