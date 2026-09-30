import { z } from "zod";
import { LOCALES } from "../locales";
import { optionalText } from "./common";

export const CEREMONY_TYPES = ["CIVIL", "CHURCH", "CIVIL_RECEPTION_ONLY"] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];

export const RSVP_MODES = ["DEDICATED", "OPEN", "BOTH"] as const;
export type RsvpMode = (typeof RSVP_MODES)[number];

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(SLUG_REGEX);

export const createWeddingSchema = z.object({
  partnerOneName: z.string().trim().min(1).max(80),
  partnerTwoName: z.string().trim().min(1).max(80),
  date: z.iso.date(),
  ceremonyType: z.enum(CEREMONY_TYPES),
  slug: slugSchema,
  locale: z.enum(LOCALES),
});
export type CreateWeddingInput = z.infer<typeof createWeddingSchema>;

export const updateWeddingSchema = createWeddingSchema.extend({
  rsvpMode: z.enum(RSVP_MODES),
  rsvpDeadline: z.iso.date().nullish().or(z.literal("")).transform((v) => v || null),
  welcomeMessage: optionalText(4000),
  giftsIntro: optionalText(2000),
  cashGiftInfo: optionalText(2000),
  /** Cena talerza dorosłego w złotych (puste = brak). */
  platePrice: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 100_000) {
        ctx.addIssue({ code: "custom", message: "invalid_amount" });
        return z.NEVER;
      }
      return Math.round(n * 100);
    }),
});
export type UpdateWeddingInput = z.input<typeof updateWeddingSchema>;

/** "Anna & Tomasz" → "anna-i-tomasz" (PL) */
export function suggestSlug(a: string, b: string, joiner = "i"): string {
  const norm = (s: string) =>
    normalizeName(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return [norm(a), joiner, norm(b)].filter(Boolean).join("-");
}

/** Małe litery, bez diakrytyków (ł → l). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
