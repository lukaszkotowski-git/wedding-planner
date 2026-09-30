import { z } from "zod";
import { TASK_CATEGORIES } from "../task-templates";
import { optionalEmail, optionalText, optionalUrl } from "./common";

const optionalDate = z.iso
  .date()
  .nullish()
  .or(z.literal(""))
  .transform((v) => v || null);

/** Kwota w złotych z formularza (liczba lub "1 299,99") → grosze. */
export const moneyToCents = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
    ctx.addIssue({ code: "custom", message: "invalid_amount" });
    return z.NEVER;
  }
  return Math.round(n * 100);
});

// ─── Zadania ────────────────────────────────────────────────────

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  category: z.enum(TASK_CATEGORIES).default("PLANNING"),
  dueDate: optionalDate,
  status: z.enum(TASK_STATUSES).default("TODO"),
  assigneeId: z.string().nullish().transform((v) => v || null),
});
export type TaskInput = z.input<typeof taskInputSchema>;

export const taskPatchSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.string().nullish(),
});

export const assigneeSchema = z.object({ name: z.string().trim().min(1).max(80) });

// ─── Kalendarz ──────────────────────────────────────────────────

export const calendarEntrySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    startsAt: z.iso.datetime({ local: true }),
    endsAt: z.iso.datetime({ local: true }).nullish().or(z.literal("")).transform((v) => v || null),
    location: optionalText(300),
    notes: optionalText(2000),
    vendorId: z.string().nullish().transform((v) => v || null),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], message: "ends_before_start" });
export type CalendarEntryInput = z.input<typeof calendarEntrySchema>;

// ─── Usługodawcy ────────────────────────────────────────────────

export const VENDOR_CATEGORIES = [
  "VENUE",
  "CATERING",
  "PHOTO",
  "VIDEO",
  "MUSIC",
  "FLOWERS",
  "CAKE",
  "ATTIRE",
  "BEAUTY",
  "TRANSPORT",
  "RINGS",
  "STATIONERY",
  "CEREMONY",
  "ACCOMMODATION",
  "OTHER",
] as const;
export const VENDOR_STATUSES = ["CONSIDERING", "BOOKED", "REJECTED"] as const;

export const vendorInputSchema = z.object({
  category: z.enum(VENDOR_CATEGORIES),
  name: z.string().trim().min(1).max(200),
  contactPerson: optionalText(120),
  phone: optionalText(40),
  email: optionalEmail,
  website: optionalUrl,
  notes: optionalText(4000),
  status: z.enum(VENDOR_STATUSES).default("CONSIDERING"),
});
export type VendorInput = z.input<typeof vendorInputSchema>;

// ─── Budżet ─────────────────────────────────────────────────────

export const budgetCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  planned: moneyToCents.default(0),
  order: z.coerce.number().int().min(0).max(1000).default(0),
});
export type BudgetCategoryInput = z.input<typeof budgetCategorySchema>;

export const paymentInputSchema = z.object({
  id: z.string().optional(),
  amount: moneyToCents,
  dueDate: optionalDate,
  paidAt: optionalDate,
  note: optionalText(300),
});

/** Koszt razem z ratami (edytowany jako całość). */
export const expenseInputSchema = z
  .object({
    categoryId: z.string().min(1),
    vendorId: z.string().nullish().transform((v) => v || null),
    title: z.string().trim().min(1).max(200),
    amount: moneyToCents,
    notes: optionalText(2000),
    payments: z.array(paymentInputSchema).max(24).default([]),
  })
  .refine((e) => e.payments.reduce((s, p) => s + p.amount, 0) <= e.amount, {
    path: ["payments"],
    message: "payments_exceed_amount",
  });
export type ExpenseInput = z.input<typeof expenseInputSchema>;

export const DEFAULT_BUDGET_CATEGORIES = {
  pl: [
    "Sala i catering",
    "Alkohol i napoje",
    "Muzyka",
    "Fotograf i kamerzysta",
    "Stroje i obrączki",
    "Fryzjer i makijaż",
    "Kwiaty i dekoracje",
    "Tort i słodki stół",
    "Zaproszenia i papeteria",
    "Transport",
    "Noclegi",
    "Ceremonia i opłaty",
    "Podróż poślubna",
    "Inne",
  ],
  en: [
    "Venue and catering",
    "Drinks",
    "Music",
    "Photo and video",
    "Attire and rings",
    "Hair and make-up",
    "Flowers and decor",
    "Cake and dessert table",
    "Invitations and stationery",
    "Transport",
    "Accommodation",
    "Ceremony and fees",
    "Honeymoon",
    "Other",
  ],
} as const;

export interface CateringEstimateInput {
  platePriceCents: number;
  adults: number;
  childAges: (number | null)[];
  tiers: { fromAge: number; toAge: number; pricePercent: number }[];
}

/** Koszt: dorośli × cena + dzieci × cena × procent progu (dziecko poza progami = 100%). */
export function cateringEstimate({ platePriceCents, adults, childAges, tiers }: CateringEstimateInput): number {
  const children = childAges.reduce<number>((sum, age) => {
    const tier = age == null ? null : tiers.find((t) => age >= t.fromAge && age <= t.toAge);
    return sum + Math.round((platePriceCents * (tier?.pricePercent ?? 100)) / 100);
  }, 0);
  return adults * platePriceCents + children;
}
