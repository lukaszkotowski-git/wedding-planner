import { DEFAULT_LOCALE, isLocale, type Locale } from "@wedding/shared";
import { resources } from "@wedding/shared/i18n";

/** Minimalny tłumacz dla serwera (maile, eksporty). Klucze jak w i18next: "mail.verify.subject". */
export function t(locale: string | null | undefined, key: string, vars: Record<string, string> = {}): string {
  const lang: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], resources[lang].translation);
  if (typeof value !== "string") return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? "");
}
