/** Data "YYYY-MM-DD" → sformatowana, bez przesunięć strefowych. */
export function formatDate(iso: string, locale: string | undefined, style: "long" | "full" | "medium" = "long") {
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** Czas ścienny "YYYY-MM-DDTHH:mm" (godzina w miejscu wesela) → "15:00". */
export function formatTime(wallClock: string, locale: string | undefined) {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "UTC" }).format(new Date(`${wallClock}:00Z`));
}

export function formatDateTime(wallClock: string, locale: string | undefined) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
    new Date(`${wallClock}:00Z`),
  );
}

export function formatMoney(cents: number | null | undefined, locale: string | undefined) {
  if (cents == null) return "";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  );
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(`${isoDate}T00:00:00Z`).getTime() - todayUtc) / 86_400_000);
}
