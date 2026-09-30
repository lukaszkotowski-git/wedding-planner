import { z } from "zod";
import { LOCALES } from "../locales";

export const CEREMONY_TYPES = ["CIVIL", "CHURCH", "CIVIL_RECEPTION_ONLY"] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];

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

/** "Anna & Tomasz" → "anna-i-tomasz" (PL) */
export function suggestSlug(a: string, b: string, joiner = "i"): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ł/g, "l")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return [norm(a), joiner, norm(b)].filter(Boolean).join("-");
}
