import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Język strony gościa: ?lang= ma pierwszeństwo, potem ustawienie pary. */
export function useGuestLocale(weddingLocale: string | undefined) {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (weddingLocale && !new URLSearchParams(window.location.search).has("lang")) {
      void i18n.changeLanguage(weddingLocale);
    }
  }, [weddingLocale, i18n]);
}
