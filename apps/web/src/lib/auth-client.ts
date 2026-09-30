import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  // Musi odpowiadać `user.additionalFields` w apps/server/src/lib/auth.ts
  plugins: [inferAdditionalFields({ user: { locale: { type: "string", required: false } } })],
});
export const { useSession, signIn, signUp, signOut } = authClient;
