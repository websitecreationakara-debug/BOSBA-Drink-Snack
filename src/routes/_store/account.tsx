import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Mail, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { toast } from "sonner";

export const Route = createFileRoute("/_store/account")({ component: Account });

function Account() {
  const { user, loading: authLoading, requestPasswordReset, resetPasswordWithOtp } = useAuth();
  const twoFactorEnabled = !!user?.twoFactorEnabled;

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Whether the account has a password (credential provider). Google-only
  // accounts don't, so they can't "change" a password — they set one via reset.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  // Set-a-password flow for Google-only accounts — done inline here (no /auth
  // round-trip, which would bounce a logged-in user back to the home page).
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resetCode, setResetCode] = useState("");

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    authClient
      .listAccounts()
      .then((res) => {
        if (active) setHasPassword((res.data ?? []).some((a) => a.providerId === "credential"));
      })
      .catch(() => {
        if (active) setHasPassword(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can’t be empty");
      return;
    }
    setSavingProfile(true);
    const { error } = await authClient.updateUser({ name: trimmed });
    setSavingProfile(false);
    if (error) toast.error(error.message ?? "Couldn’t update profile");
    else toast.success("Profile updated");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don’t match.");
      return;
    }
    setChangingPw(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });
    setChangingPw(false);
    if (error) {
      toast.error(error.message ?? "Couldn’t change password");
      return;
    }
    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const sendResetCode = async () => {
    if (!user) return;
    setSendingCode(true);
    const { error } = await requestPasswordReset(user.email);
    setSendingCode(false);
    if (error) {
      toast.error(error);
      return;
    }
    setCodeSent(true);
    toast.success(`We sent a code to ${user.email}.`);
  };

  const setPasswordViaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don’t match.");
      return;
    }
    setChangingPw(true);
    const { error } = await resetPasswordWithOtp(user.email, resetCode.trim(), newPassword);
    setChangingPw(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Password set — you can now sign in with email too.");
    setHasPassword(true);
    setCodeSent(false);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12 space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="size-20 rounded-full bg-muted grid place-items-center mx-auto mb-6">
          <User className="size-8 text-muted-foreground" />
        </div>
        <h1 className="font-display font-semibold tracking-tight text-3xl">
          Sign in to manage your account
        </h1>
        <p className="text-muted-foreground mt-2">Update your profile and password from here.</p>
        <Link
          to="/auth"
          className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12 space-y-6">
      <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl">Account</h1>

      {/* Profile */}
      <form onSubmit={saveProfile} className="bg-card border rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User className="size-5 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg">Profile</h2>
        </div>
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>Email</Label>
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Email can’t be changed here yet — contact us if you need to update it.
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={savingProfile} className="rounded-full">
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Password */}
      <div className="bg-card border rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg">Password</h2>
        </div>

        {hasPassword === null ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : hasPassword ? (
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <Label>Current password</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={changingPw} className="rounded-full">
                {changingPw ? "Updating…" : "Change password"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm">
              <KeyRound className="size-5 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                You sign in with Google. Add a password so you can also sign in with your email —
                we’ll send a code to{" "}
                <span className="font-medium text-foreground">{user.email}</span> to confirm it’s
                you.
              </p>
            </div>
            {!codeSent ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={sendResetCode}
                  disabled={sendingCode}
                  className="rounded-full"
                >
                  {sendingCode ? "Sending…" : "Send code to set a password"}
                </Button>
              </div>
            ) : (
              <form onSubmit={setPasswordViaCode} className="space-y-4">
                <div>
                  <Label>Verification code</Label>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Enter the 6-digit code we sent to {user.email}.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>New password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Confirm new password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={sendResetCode}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Resend code
                  </button>
                  <Button type="submit" disabled={changingPw} className="rounded-full">
                    {changingPw ? "Setting…" : "Set password"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Two-factor authentication */}
      {hasPassword && (
        <div className="bg-card border rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg">Security</h2>
          </div>
          <TwoFactorSetup
            enabled={twoFactorEnabled}
            onChanged={() => toast.success("Two-factor settings updated")}
          />
        </div>
      )}
    </div>
  );
}
