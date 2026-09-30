import { DEFAULT_LOCALE, LOCALES } from "@wedding/shared/locales";
import { resources } from "@wedding/shared/i18n";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ["querystring", "localStorage", "navigator"], lookupQuerystring: "lang" },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
