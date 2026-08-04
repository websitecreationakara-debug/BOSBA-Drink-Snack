import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { recordAdminAction } from "@/data/audit";
import { useAuth } from "@/hooks/use-auth";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ban, Check, KeyRound, MailCheck, MailX, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: UsersAdmin });

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  emailVerified?: boolean | null;
  createdAt: string | Date;
};

function UsersAdmin() {
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" },
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to load users");
      return (res.data?.users ?? []) as AdminUser[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const changeRole = async (userId: string, role: string) => {
    const target = users.find((u) => u.id === userId);
    const res = await authClient.admin.setRole({ userId, role: role as "user" | "admin" });
    if (res.error) return toast.error(res.error.message ?? "Failed to change role");
    recordAdminAction({
      data: { action: "role_change", detail: { targetUserId: userId, targetEmail: target?.email, oldRole: target?.role, newRole: role } },
    }).catch(() => {});
    toast.success("Role updated");
    refresh();
  };

  const toggleBan = async (u: AdminUser) => {
    const res = u.banned
      ? await authClient.admin.unbanUser({ userId: u.id })
      : await authClient.admin.banUser({ userId: u.id });
    if (res.error) return toast.error(res.error.message ?? "Failed to update");
    recordAdminAction({
      data: { action: "user_ban", detail: { targetUserId: u.id, targetEmail: u.email, banned: !u.banned } },
    }).catch(() => {});
    toast.success(u.banned ? "User unbanned" : "User banned");
    refresh();
  };

  const toggleVerified = async (u: AdminUser) => {
    const res = await authClient.admin.updateUser({
      userId: u.id,
      data: { emailVerified: !u.emailVerified },
    });
    if (res.error) return toast.error(res.error.message ?? "Failed to update");
    toast.success(u.emailVerified ? "Marked unverified" : "Email verified");
    refresh();
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    const res = await authClient.admin.removeUser({ userId: u.id });
    if (res.error) return toast.error(res.error.message ?? "Failed to delete");
    recordAdminAction({
      data: { action: "user_delete", detail: { targetUserId: u.id, targetEmail: u.email, role: u.role } },
    }).catch(() => {});
    toast.success("User deleted");
    refresh();
  };

  const createUser = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      return toast.error("Name and email are required.");
    }
    if (addForm.password.length < 8) {
      return toast.error("Password must be at least 8 characters.");
    }
    setBusy(true);
    const res = await authClient.admin.createUser({
      name: addForm.name.trim(),
      email: addForm.email.trim(),
      password: addForm.password,
      role: addForm.role as "user" | "admin",
      // Admin-created accounts skip the email-verification gate so they can sign in right away.
      data: { emailVerified: true },
    });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Failed to create user");
    toast.success(`Created ${addForm.email}`);
    setAddOpen(false);
    setAddForm({ name: "", email: "", password: "", role: "user" });
    refresh();
  };

  const setPassword = async () => {
    if (!pwTarget) return;
    if (newPassword.length < 8) {
      return toast.error("Password must be at least 8 characters.");
    }
    setBusy(true);
    const res = await authClient.admin.setUserPassword({
      userId: pwTarget.id,
      newPassword,
    });
    if (res.error) {
      setBusy(false);
      return toast.error(res.error.message ?? "Failed to set password");
    }
    // A reset is useless if the account is still gated behind verification — un-gate it.
    if (!pwTarget.emailVerified) {
      await authClient.admin.updateUser({ userId: pwTarget.id, data: { emailVerified: true } });
    }
    setBusy(false);
    toast.success(`Password updated for ${pwTarget.email}`);
    setPwTarget(null);
    setNewPassword("");
    refresh();
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Users</h1>
          <p className="text-muted-foreground mt-1">{users.length} total</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 rounded-full font-bold">
          <UserPlus className="size-4" /> Add user
        </Button>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Joined</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-6 py-3">
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-6 py-3">
                    <Select
                      value={u.role ?? "user"}
                      onValueChange={(v) => changeRole(u.id, v)}
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={
                          u.banned
                            ? "px-2 py-0.5 rounded text-xs font-bold uppercase bg-destructive/10 text-destructive"
                            : "px-2 py-0.5 rounded text-xs font-bold uppercase bg-muted"
                        }
                      >
                        {u.banned ? "Banned" : "Active"}
                      </span>
                      {!u.emailVerified && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-warning/10 text-warning">
                          Unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.emailVerified ? "Mark unverified" : "Verify email"}
                        onClick={() => toggleVerified(u)}
                      >
                        {u.emailVerified ? (
                          <MailX className="size-4" />
                        ) : (
                          <MailCheck className="size-4 text-brand" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Set password"
                        onClick={() => {
                          setPwTarget(u);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.banned ? "Unban" : "Ban"}
                        onClick={() => toggleBan(u)}
                        disabled={isSelf}
                      >
                        {u.banned ? (
                          <Check className="size-4 text-brand" />
                        ) : (
                          <Ban className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => remove(u)}
                        disabled={isSelf}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  No users yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates a verified account that can sign in immediately with this password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-name">Full name</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="text"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="add-role">Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(v) => setAddForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger id="add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={busy}>
              {busy ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Set a new password for {pwTarget?.email}. They can sign in with it right away.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="text"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={setPassword} disabled={busy}>
              {busy ? "Saving..." : "Set password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
