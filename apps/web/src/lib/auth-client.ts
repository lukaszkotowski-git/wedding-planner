import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { useEffect, useState } from "react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  // Musi odpowiadać `user.additionalFields` w apps/server/src/lib/auth.ts
  plugins: [inferAdditionalFields({ user: { locale: { type: "string", required: false } } })],
});
export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Sesja z „gotowością” ustawianą raz na zawsze.
 * Better Auth przy każdym ponownym pobraniu sesji niezalogowanego użytkownika ustawia `isPending = true`
 * (np. po rejestracji). Gdyby strażnicy tras reagowali na to jak na pierwsze ładowanie, odmontowaliby stronę
 * i zgubili jej stan (np. komunikat „sprawdź skrzynkę”).
 */
export function useAuth() {
  const { data, isPending } = useSession();
  const [settled, setSettled] = useState(!isPending);
  useEffect(() => {
    if (!isPending) setSettled(true);
  }, [isPending]);
  return { session: data, user: data?.user ?? null, ready: settled || !isPending };
}
