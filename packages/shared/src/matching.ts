import { normalizeName } from "./schemas/wedding";

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

/** Podobieństwo trigramowe (jak pg_trgm), 0..1. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(normalizeName(a));
  const tb = trigrams(normalizeName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / (ta.size + tb.size - common);
}

export interface MatchCandidate {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Dopasowanie wpisanego imienia i nazwiska do listy gości.
 * Nazwisko musi być podobne (≥ 0.5), imię luźniej (≥ 0.35: zdrobnienia, literówki).
 */
export function matchGuests<T extends MatchCandidate>(
  query: { firstName: string; lastName: string },
  guests: T[],
  limit = 5,
): T[] {
  return guests
    .map((g) => {
      const last = similarity(query.lastName, g.lastName);
      const first = similarity(query.firstName, g.firstName);
      return { g, last, first, score: last * 0.6 + first * 0.4 };
    })
    .filter((m) => m.last >= 0.5 && m.first >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.g);
}
