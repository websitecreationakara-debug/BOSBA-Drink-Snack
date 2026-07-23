import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import type { getAuth } from "@/lib/auth";

// Same-origin: the client talks to /api/auth/* served by the request middleware.
export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    twoFactorClient(),
    inferAdditionalFields<ReturnType<typeof getAuth>>(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
