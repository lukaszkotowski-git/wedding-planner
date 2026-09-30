import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { LOCALES } from "@wedding/shared";

export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { data } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [, navigate] = useLocation();

  return (
    <header className="border-b">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href={data ? "/app" : "/"} className="font-serif text-xl font-semibold">
          {t("app.name")}
        </Link>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border p-0.5" role="group" aria-label={t("nav.language")}>
            {LOCALES.map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => void i18n.changeLanguage(lng)}
                aria-pressed={i18n.resolvedLanguage === lng}
                className="rounded px-2 py-1 text-xs font-medium uppercase text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
              >
                {lng}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.theme")}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
          {data ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              <LogOut />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
