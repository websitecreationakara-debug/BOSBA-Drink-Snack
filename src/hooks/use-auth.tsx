import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { withCaptcha } from "@/lib/recaptcha";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  twoFactorEnabled: boolean;
} | null;

type AuthCtx = {
  user: AuthUser;
  loading: boolean;
  isAdmin: boolean;
  isSales: boolean;
  isMarketing: boolean;
  isStaff: boolean;
  // Anyone allowed into the /admin area: admin, sales, or marketing.
  canAccessAdmin: boolean;
  // `twoFactorRequired` is true when the password was correct but a TOTP code is
  // still needed — the caller should prompt for it and call verifyTotp.
  signIn: (email: string, password: string) => Promise<{ error: string | null; twoFactorRequired?: boolean }>;
  verifyTotp: (code: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resetPasswordWithOtp: (
    email: string,
    otp: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();

  const u = data?.user as
    | { id: string; email: string; name?: string | null; role?: string | null; twoFactorEnabled?: boolean | null }
    | undefined;
  const user: AuthUser = u
    ? { id: u.id, email: u.email, name: u.name ?? null, role: u.role ?? null, twoFactorEnabled: !!u.twoFactorEnabled }
    : null;

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const res = await authClient.signIn.email({
      email,
      password,
      ...(await withCaptcha("sign_in")),
    });
    // With 2FA enabled, better-auth returns twoFactorRedirect and withholds the
    // session until a valid TOTP code is supplied via verifyTotp.
    const twoFactorRequired = !!(res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect;
    return { error: res.error?.message ?? null, twoFactorRequired };
  };

  const verifyTotp: AuthCtx["verifyTotp"] = async (code) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    return { error: error?.message ?? null };
  };

  const signUp: AuthCtx["signUp"] = async (email, password, fullName, phone) => {
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: fullName,
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
      ...(await withCaptcha("sign_up")),
    });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle: AuthCtx["signInWithGoogle"] = async () => {
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    return { error: error?.message ?? null };
  };

  const verifyEmailOtp: AuthCtx["verifyEmailOtp"] = async (email, otp) => {
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    return { error: error?.message ?? null };
  };

  const resendOtp: AuthCtx["resendOtp"] = async (email) => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    return { error: error?.message ?? null };
  };

  const requestPasswordReset: AuthCtx["requestPasswordReset"] = async (email) => {
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email,
      ...(await withCaptcha("password_reset")),
    });
    return { error: error?.message ?? null };
  };

  const resetPasswordWithOtp: AuthCtx["resetPasswordWithOtp"] = async (email, otp, password) => {
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading: isPending,
        isAdmin: user?.role === "admin",
        isSales: user?.role === "sales",
        isMarketing: user?.role === "marketing",
        isStaff: user?.role === "admin" || user?.role === "sales",
        canAccessAdmin:
          user?.role === "admin" || user?.role === "sales" || user?.role === "marketing",
        signIn,
        verifyTotp,
        signUp,
        signInWithGoogle,
        verifyEmailOtp,
        resendOtp,
        requestPasswordReset,
        resetPasswordWithOtp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
