import type { EventPart, Guest, Household, MealOption, Prisma, Wedding } from "@prisma/client";
import { rsvpSubmitSchema, type GuestInput } from "@wedding/shared";
import { z } from "zod";
import { env } from "../../env";
import { prisma } from "../../lib/db";
import { badRequest } from "../../lib/http";
import { t } from "../../lib/i18n";
import { sendMailInBackground } from "../../lib/mail";
import { coupleName } from "../weddings/serialize";

export const householdInclude = {
  invitedParts: { select: { id: true } },
  guests: {
    where: { isPlusOne: false },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { rsvps: true, plusOne: { include: { rsvps: true } } },
  },
} satisfies Prisma.HouseholdInclude;

export type HouseholdWithGuests = Prisma.HouseholdGetPayload<{ include: typeof householdInclude }>;
type GuestWithRsvps = HouseholdWithGuests["guests"][number];

export const rsvpUrl = (slug: string, token: string) => `${env.APP_URL}/w/${slug}/r/${token}`;

/** Brak jawnie wybranych części = zaproszenie na wszystkie. */
export function effectiveParts<P extends Pick<EventPart, "id">>(household: { invitedParts: { id: string }[] }, all: P[]): P[] {
  if (household.invitedParts.length === 0) return all;
  const ids = new Set(household.invitedParts.map((p) => p.id));
  return all.filter((p) => ids.has(p.id));
}

export type HouseholdStatus = "PENDING" | "ATTENDING" | "DECLINED";

export function householdStatus(h: HouseholdWithGuests): HouseholdStatus {
  if (!h.respondedAt) return "PENDING";
  return h.guests.some((g) => g.rsvps.some((r) => r.attending)) ? "ATTENDING" : "DECLINED";
}

function serializeGuest(g: Guest & { rsvps: { eventPartId: string; attending: boolean }[] }) {
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    type: g.type,
    age: g.age,
    plusOneAllowed: g.plusOneAllowed,
    mealOptionId: g.mealOptionId,
    dietNotes: g.dietNotes,
    needsHighChair: g.needsHighChair,
    needsSeparateSeat: g.needsSeparateSeat,
    attendance: Object.fromEntries(g.rsvps.map((r) => [r.eventPartId, r.attending])),
  };
}

export function serializeHousehold(h: HouseholdWithGuests, slug: string) {
  return {
    id: h.id,
    name: h.name,
    email: h.email,
    phone: h.phone,
    side: h.side,
    tags: h.tags,
    notes: h.notes,
    source: h.source,
    invitedPartIds: h.invitedParts.map((p) => p.id),
    needsAccommodation: h.needsAccommodation,
    needsTransport: h.needsTransport,
    messageToCouple: h.messageToCouple,
    respondedAt: h.respondedAt,
    locked: h.locked,
    status: householdStatus(h),
    rsvpUrl: rsvpUrl(slug, h.token),
    guests: h.guests.map((g) => ({ ...serializeGuest(g), plusOne: g.plusOne ? serializeGuest(g.plusOne) : null })),
  };
}

export function guestSlotsOf(guests: Pick<GuestInput, "plusOneAllowed" | "type">[]) {
  return guests.length + guests.filter((g) => g.plusOneAllowed && g.type !== "CHILD").length;
}

// ─── Zapis RSVP (gość lub para) ─────────────────────────────────

/** Para edytująca ręcznie nie zaznacza zgody w imieniu gościa. */
export const adminRsvpSchema = rsvpSubmitSchema.extend({ consent: z.boolean().optional() });
type RsvpData = z.output<typeof adminRsvpSchema>;

function mealAllowed(option: MealOption | undefined, guestType: "ADULT" | "CHILD") {
  return !!option && option.active && (guestType === "CHILD" || !option.forChildren);
}

/**
 * Waliduje kompletność odpowiedzi i zapisuje ją w jednej transakcji.
 * Wymaga odpowiedzi dla każdego gościa i każdej części, na którą gospodarstwo jest zaproszone.
 */
export async function applyRsvp(
  household: HouseholdWithGuests,
  wedding: Wedding & { eventParts: EventPart[]; mealOptions: MealOption[] },
  input: RsvpData,
) {
  const parts = effectiveParts(household, wedding.eventParts);
  const partIds = parts.map((p) => p.id).sort();
  const hosts = new Map(household.guests.map((g) => [g.id, g]));
  const options = new Map(wedding.mealOptions.map((o) => [o.id, o]));
  const activeOptions = wedding.mealOptions.filter((o) => o.active);

  if (input.guests.length !== hosts.size || new Set(input.guests.map((g) => g.guestId)).size !== hosts.size) {
    throw badRequest("rsvp_incomplete");
  }

  const plan = input.guests.map((answer) => {
    const guest = hosts.get(answer.guestId);
    if (!guest) throw badRequest("rsvp_unknown_guest");
    const keys = Object.keys(answer.attendance).sort();
    if (keys.length !== partIds.length || keys.some((k, i) => k !== partIds[i])) throw badRequest("rsvp_incomplete");
    const attendingAny = Object.values(answer.attendance).some(Boolean);

    let mealOptionId: string | null = null;
    if (attendingAny && activeOptions.some((o) => mealAllowed(o, guest.type))) {
      if (!answer.mealOptionId || !mealAllowed(options.get(answer.mealOptionId), guest.type)) {
        throw badRequest("rsvp_meal_required", { guestId: guest.id });
      }
      mealOptionId = answer.mealOptionId;
    }

    let plusOne = answer.plusOne ?? null;
    if (plusOne) {
      if (!guest.plusOneAllowed || !attendingAny) throw badRequest("plus_one_not_allowed", { guestId: guest.id });
      if (plusOne.mealOptionId && !mealAllowed(options.get(plusOne.mealOptionId), "ADULT")) {
        throw badRequest("rsvp_meal_required", { guestId: guest.id });
      }
      if (!plusOne.mealOptionId && activeOptions.some((o) => mealAllowed(o, "ADULT"))) {
        throw badRequest("rsvp_meal_required", { guestId: guest.id });
      }
    }
    return { guest, answer, mealOptionId, plusOne, attendingAny };
  });

  await prisma.$transaction(async (tx) => {
    for (const { guest, answer, mealOptionId, plusOne, attendingAny } of plan) {
      const rsvps = Object.entries(answer.attendance).map(([eventPartId, attending]) => ({ eventPartId, attending }));
      await tx.guest.update({
        where: { id: guest.id },
        data: { mealOptionId, dietNotes: attendingAny ? answer.dietNotes : null },
      });
      await tx.guestEventRsvp.deleteMany({ where: { guestId: guest.id } });
      await tx.guestEventRsvp.createMany({ data: rsvps.map((r) => ({ ...r, guestId: guest.id })) });

      if (plusOne) {
        const data = {
          firstName: plusOne.firstName,
          lastName: plusOne.lastName,
          mealOptionId: plusOne.mealOptionId ?? null,
          dietNotes: plusOne.dietNotes,
        };
        const saved = guest.plusOne
          ? await tx.guest.update({ where: { id: guest.plusOne.id }, data })
          : await tx.guest.create({
              data: {
                ...data,
                weddingId: wedding.id,
                householdId: household.id,
                isPlusOne: true,
                plusOneOfId: guest.id,
              },
            });
        await tx.guestEventRsvp.deleteMany({ where: { guestId: saved.id } });
        await tx.guestEventRsvp.createMany({ data: rsvps.map((r) => ({ ...r, guestId: saved.id })) });
      } else if (guest.plusOne) {
        await tx.guest.delete({ where: { id: guest.plusOne.id } });
      }
    }

    await tx.household.update({
      where: { id: household.id },
      data: {
        email: input.email ?? household.email,
        needsAccommodation: input.needsAccommodation ?? null,
        needsTransport: input.needsTransport ?? null,
        messageToCouple: input.messageToCouple,
        respondedAt: new Date(),
        locked: true,
      },
    });
  });

  return plan;
}

export function sendRsvpConfirmation(
  wedding: Wedding & { eventParts: EventPart[] },
  household: Household & { invitedParts: { id: string }[] },
  plan: Awaited<ReturnType<typeof applyRsvp>>,
  locale: string,
) {
  const to = household.email;
  if (!to) return;
  const partName = new Map(wedding.eventParts.map((p) => [p.id, p.name]));
  const lines = plan.flatMap(({ guest, answer, plusOne, attendingAny }) => {
    const parts = Object.entries(answer.attendance)
      .filter(([, yes]) => yes)
      .map(([id]) => partName.get(id))
      .join(", ");
    const line = (name: string) =>
      attendingAny ? t(locale, "mail.rsvp.attending", { name, parts }) : t(locale, "mail.rsvp.notAttending", { name });
    const out = [line(`${guest.firstName} ${guest.lastName}`.trim())];
    if (plusOne) out.push(line(`${plusOne.firstName} ${plusOne.lastName}`));
    return out;
  });
  const couple = coupleName(wedding);
  sendMailInBackground({
    to,
    locale,
    subject: t(locale, "mail.rsvp.subject", { couple }),
    body: t(locale, "mail.rsvp.body", { couple }),
    lines,
    cta: t(locale, "mail.rsvp.cta"),
    url: `${env.APP_URL}/w/${wedding.slug}`,
  });
}

export type { GuestWithRsvps };
