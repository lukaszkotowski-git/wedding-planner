import { lazy, Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Redirect, Route, Switch } from "wouter";
import { AppHeader } from "@/components/app-header";
import { useSession } from "@/lib/auth-client";
import { LoginPage, RegisterPage } from "@/pages/auth";
import { InvitePage } from "@/pages/invite";
import { LandingPage } from "@/pages/landing";
import { LegalPage } from "@/pages/legal";

// Panel pary w osobnym fragmencie: goście na stronie wesela go nie pobierają.
const WeddingLayout = lazy(() => import("@/pages/wedding/layout").then((m) => ({ default: m.WeddingLayout })));
const DashboardPage = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  const { t } = useTranslation();
  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (!data) {
    // Po zalogowaniu wracamy tam, gdzie użytkownik chciał wejść (np. link z zaproszenia do zespołu).
    sessionStorage.setItem("afterLogin", window.location.pathname);
    return <Redirect to="~/login" />;
  }
  return <Suspense fallback={<p className="container py-16 text-muted-foreground">{t("common.loading")}</p>}>{children}</Suspense>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) return null;
  if (data) return <Redirect to={sessionStorage.getItem("afterLogin") ?? "/app"} />;
  return children;
}

export function AppShell() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader />
      <main>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/privacy">
            <LegalPage doc="privacy" />
          </Route>
          <Route path="/terms">
            <LegalPage doc="terms" />
          </Route>
          <Route path="/login">
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          </Route>
          <Route path="/register">
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          </Route>
          <Route path="/invite/:token">
            {({ token }) => (
              <RequireAuth>
                <InvitePage token={token} />
              </RequireAuth>
            )}
          </Route>
          <Route path="/app/w/:id" nest>
            {({ id }) => (
              <RequireAuth>
                <WeddingLayout key={id} id={id} />
              </RequireAuth>
            )}
          </Route>
          <Route path="/app">
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          </Route>
          <Route>
            <p className="container py-16 text-muted-foreground">{t("common.notFound")}</p>
          </Route>
        </Switch>
      </main>
    </>
  );
}
