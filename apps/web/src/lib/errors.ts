import type { TFunction } from "i18next";
import { ApiError } from "./api";

/** Kod błędu z API → komunikat dla użytkownika. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return t("errors.too_many_requests");
    const key = `errors.${error.code}`;
    const translated = t(key, { max: error.details?.max, defaultValue: "" });
    if (translated) return translated;
    if (error.status === 403) return t("errors.forbidden");
    if (error.status === 404) return t("errors.not_found");
    return t("errors.generic");
  }
  if (error instanceof TypeError) return t("errors.network");
  return t("errors.generic");
}
