import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

interface PublicWedding {
  slug: string;
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  locale: string;
}

/** Publiczna strona wydarzenia. W fazie 1: harmonogram, RSVP, prezenty. */
export function PublicWeddingPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ["public-wedding", slug],
    queryFn: () => api<PublicWedding>(`/public/weddings/${encodeURIComponent(slug)}`),
  });

  // Język gościa: ?lang= ma pierwszeństwo, potem ustawienie pary.
  useEffect(() => {
    if (data && !new URLSearchParams(window.location.search).has("lang")) {
      void i18n.changeLanguage(data.locale);
    }
  }, [data, i18n]);

  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (isError || !data) return <p className="container py-16 text-center">{t("public.notFound")}</p>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">{t("public.invite")}</p>
      <h1 className="font-serif text-5xl font-semibold sm:text-7xl">
        {data.partnerOneName} <span className="text-primary">&</span> {data.partnerTwoName}
      </h1>
      <p className="text-lg">
        {new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "full" }).format(new Date(data.date))}
      </p>
    </main>
  );
}
