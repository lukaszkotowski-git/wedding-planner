import { z } from "zod";
import { LOCALES } from "../locales";
import { optionalEmail, optionalText } from "./common";

export const GUEST_SIDES = ["PARTNER_ONE", "PARTNER_TWO", "BOTH"] as const;
export type GuestSide = (typeof GUEST_SIDES)[number];

export const GUEST_TYPES = ["ADULT", "CHILD"] as const;
export type GuestType = (typeof GUEST_TYPES)[number];

export const guestInputSchema = z
  .object({
    /** Istniejący gość (edycja); brak → nowy. */
    id: z.string().optional(),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80).default(""),
    type: z.enum(GUEST_TYPES).default("ADULT"),
    age: z.coerce.number().int().min(0).max(17).nullish(),
    plusOneAllowed: z.boolean().default(false),
    mealOptionId: z.string().nullish(),
    dietNotes: optionalText(500),
    needsHighChair: z.boolean().default(false),
    needsSeparateSeat: z.boolean().default(true),
  })
  .transform((g) =>
    g.type === "ADULT"
      ? { ...g, age: null, needsHighChair: false, needsSeparateSeat: true }
      : { ...g, plusOneAllowed: false, age: g.age ?? null },
  );
export type GuestInput = z.input<typeof guestInputSchema>;

export const householdInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: optionalEmail,
  phone: optionalText(40),
  side: z.enum(GUEST_SIDES).default("BOTH"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: optionalText(2000),
  /** Puste = zaproszenie na wszystkie części. */
  invitedPartIds: z.array(z.string()).max(20).default([]),
  guests: z.array(guestInputSchema).min(1).max(20),
});
export type HouseholdInput = z.input<typeof householdInputSchema>;

// ─── Publiczne RSVP ─────────────────────────────────────────────

export const rsvpGuestSchema = z.object({
  guestId: z.string(),
  /** eventPartId → czy będzie */
  attendance: z.record(z.string(), z.boolean()),
  mealOptionId: z.string().nullish(),
  dietNotes: optionalText(500),
  plusOne: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      mealOptionId: z.string().nullish(),
      dietNotes: optionalText(500),
    })
    .nullish(),
});

export const rsvpSubmitSchema = z.object({
  guests: z.array(rsvpGuestSchema).min(1).max(20),
  email: optionalEmail,
  needsAccommodation: z.boolean().nullish(),
  needsTransport: z.boolean().nullish(),
  messageToCouple: optionalText(2000),
  consent: z.literal(true),
});
export type RsvpSubmitInput = z.input<typeof rsvpSubmitSchema>;

export const rsvpSearchSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
});

export const joinRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  message: optionalText(1000),
  locale: z.enum(LOCALES).default("pl"),
  consent: z.literal(true),
});
