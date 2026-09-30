import { z } from "zod";
import { LOCALES } from "../locales";
import { optionalText, optionalUrl } from "./common";

const optionalMoney = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "invalid_amount" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

/** Kwoty w formularzu w złotych; po parsowaniu w groszach (priceCents/targetCents). */
export const giftInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(2000),
    url: optionalUrl,
    price: optionalMoney,
    isGroupGift: z.boolean().default(false),
    target: optionalMoney,
    hidden: z.boolean().default(false),
    order: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .refine((g) => !g.isGroupGift || (g.target ?? 0) > 0, { path: ["target"], message: "target_required" })
  .transform(({ price, target, ...g }) => ({
    ...g,
    priceCents: price,
    targetCents: g.isGroupGift ? target : null,
  }));
export type GiftInput = z.input<typeof giftInputSchema>;

export const giftReserveSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  amount: optionalMoney,
  locale: z.enum(LOCALES).default("pl"),
  consent: z.literal(true),
});

export const tokenSchema = z.object({ token: z.string().min(10).max(100) });

export const RESERVATION_PENDING_MINUTES = 30;

export interface ReservationLike {
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  expiresAt: Date;
  amountCents: number | null;
}

/** Rezerwacja blokuje prezent, jeśli jest potwierdzona lub oczekuje i nie wygasła. */
export function isReservationActive(r: ReservationLike, now = new Date()): boolean {
  return r.status === "CONFIRMED" || (r.status === "PENDING" && r.expiresAt > now);
}

export interface GiftAvailability {
  available: boolean;
  /** Tylko dla składkowych: zebrane (potwierdzone) i zadeklarowane (potwierdzone + oczekujące). */
  confirmedCents: number;
  pledgedCents: number;
  remainingCents: number | null;
}

export function giftAvailability(
  gift: { isGroupGift: boolean; targetCents: number | null },
  reservations: ReservationLike[],
  now = new Date(),
): GiftAvailability {
  const active = reservations.filter((r) => isReservationActive(r, now));
  if (!gift.isGroupGift) {
    return { available: active.length === 0, confirmedCents: 0, pledgedCents: 0, remainingCents: null };
  }
  const sum = (list: ReservationLike[]) => list.reduce((acc, r) => acc + (r.amountCents ?? 0), 0);
  const pledged = sum(active);
  const confirmed = sum(active.filter((r) => r.status === "CONFIRMED"));
  const remaining = Math.max(0, (gift.targetCents ?? 0) - pledged);
  return { available: remaining > 0, confirmedCents: confirmed, pledgedCents: pledged, remainingCents: remaining };
}
