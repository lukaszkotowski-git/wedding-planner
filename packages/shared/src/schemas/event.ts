import { z } from "zod";
import { optionalText, optionalUrl } from "./common";

export const eventPartSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    /** "2027-06-12T15:00" (czas lokalny wesela) */
    startsAt: z.iso.datetime({ local: true }),
    endsAt: z.iso.datetime({ local: true }).nullish().or(z.literal("")).transform((v) => v || null),
    locationName: optionalText(200),
    address: optionalText(300),
    mapUrl: optionalUrl,
    notes: optionalText(2000),
    order: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], message: "ends_before_start" });
export type EventPartInput = z.input<typeof eventPartSchema>;

export const mealOptionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  forChildren: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.coerce.number().int().min(0).max(1000).default(0),
});
export type MealOptionInput = z.input<typeof mealOptionSchema>;

export const childPriceTierSchema = z
  .object({
    fromAge: z.coerce.number().int().min(0).max(17),
    toAge: z.coerce.number().int().min(0).max(17),
    pricePercent: z.coerce.number().int().min(0).max(100),
  })
  .refine((v) => v.toAge >= v.fromAge, { path: ["toAge"], message: "to_before_from" });
export type ChildPriceTierInput = z.input<typeof childPriceTierSchema>;

export const childPriceTiersSchema = z
  .array(childPriceTierSchema)
  .max(10)
  .refine(
    (tiers) => {
      const sorted = [...tiers].sort((a, b) => a.fromAge - b.fromAge);
      return sorted.every((t, i) => i === 0 || t.fromAge > sorted[i - 1]!.toAge);
    },
    { message: "tiers_overlap" },
  );

export function tierForAge<T extends { fromAge: number; toAge: number }>(tiers: T[], age: number | null | undefined) {
  if (age == null) return null;
  return tiers.find((t) => age >= t.fromAge && age <= t.toAge) ?? null;
}
