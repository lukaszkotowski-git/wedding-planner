import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  const { t } = useTranslation();
  return (
    <section className="container flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-tight sm:text-6xl">{t("app.name")}</h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("app.tagline")}</p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/register">{t("nav.register")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">{t("nav.login")}</Link>
        </Button>
      </div>
    </section>
  );
}
