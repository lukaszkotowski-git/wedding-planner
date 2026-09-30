/**
 * Czasy części wydarzenia to „czas ścienny” w strefie wesela. Przechowujemy je jako UTC
 * z tymi samymi cyframi ("2027-06-12T15:00" → 2027-06-12T15:00:00Z) i zawsze formatujemy w UTC.
 * Dzięki temu godzina na zaproszeniu nie przesuwa się zależnie od strefy przeglądarki gościa.
 */
export function wallClockToDate(local: string): Date {
  return new Date(`${local.length === 16 ? `${local}:00` : local}Z`);
}

export function dateToWallClock(d: Date): string {
  return d.toISOString().slice(0, 16);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dzisiejsza data (YYYY-MM-DD) w podanej strefie. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
