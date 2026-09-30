import { useTheme } from "next-themes";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { GiftActionPage } from "@/pages/public/gift-action-page";
import { RsvpPage } from "@/pages/public/rsvp-page";
import { PublicWeddingPage } from "@/pages/public/wedding-page";

// Panel, logowanie i landing w osobnych fragmentach: goście na stronie wesela ich nie pobierają.
const AppShell = lazy(() => import("@/app-shell").then((m) => ({ default: m.AppShell })));

export function App() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  return (
    <>
      <Switch>
        <Route path="/w/:slug" nest>
          {({ slug }) => (
            <Switch>
              <Route path="/r/:token">{({ token }) => <RsvpPage token={token} />}</Route>
              <Route path="/gift" component={GiftActionPage} />
              <Route>
                <PublicWeddingPage slug={slug} />
              </Route>
            </Switch>
          )}
        </Route>
        <Route>
          <Suspense fallback={<p className="container py-16 text-muted-foreground">{t("common.loading")}</p>}>
            <AppShell />
          </Suspense>
        </Route>
      </Switch>
      <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} richColors position="top-center" />
    </>
  );
}
