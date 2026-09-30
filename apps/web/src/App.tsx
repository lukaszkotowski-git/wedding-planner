import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Redirect, Route, Switch } from "wouter";
import { AppHeader } from "@/components/app-header";
import { useSession } from "@/lib/auth-client";
import { DashboardPage } from "@/pages/dashboard";
import { LandingPage } from "@/pages/landing";
import { LoginPage, RegisterPage } from "@/pages/auth";
import { PublicWeddingPage } from "@/pages/public-wedding";

function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  const { t } = useTranslation();
  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <Redirect to="/login" />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) return null;
  if (data) return <Redirect to="/app" />;
  return children;
}

export function App() {
  const { t } = useTranslation();
  return (
    <Switch>
      {/* Strona gościa: bez nagłówka panelu */}
      <Route path="/w/:slug" nest>
        {(params) => <PublicWeddingPage slug={params.slug} />}
      </Route>

      <Route>
        <AppHeader />
        <main>
          <Switch>
            <Route path="/">
              <LandingPage />
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
            <Route path="/app" nest>
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            </Route>
            <Route>
              <p className="container py-16 text-muted-foreground">{t("common.notFound")}</p>
            </Route>
          </Switch>
        </main>
      </Route>
    </Switch>
  );
}
