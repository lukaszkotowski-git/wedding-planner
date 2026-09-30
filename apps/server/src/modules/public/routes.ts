import {
  CONSENT_TEXT_VERSION,
  PLANS,
  RESERVATION_PENDING_MINUTES,
  giftAvailability,
  giftReserveSchema,
  joinRequestSchema,
  matchGuests,
  rsvpSearchSchema,
  rsvpSubmitSchema,
  slugSchema,
  tokenSchema,
} from "@wedding/shared";
import { Router } from "express";
import { env } from "../../env";
import { prisma } from "../../lib/db";
import { dateToWallClock, isoDate, todayIn } from "../../lib/dates";
import { HttpError, badRequest, conflict, gone, notFound, param } from "../../lib/http";
import { t } from "../../lib/i18n";
import { sendMailInBackground } from "../../lib/mail";
import { limiter } from "../../lib/rate-limit";
import { hashIp, randomToken } from "../../lib/tokens";
import { serializable } from "../../lib/tx";
import { publicGift } from "../gifts/service";
import { effectiveParts, householdInclude, applyRsvp, sendRsvpConfirmation } from "../guests/service";
import { coupleName } from "../weddings/serialize";

/** Endpointy dostępne bez logowania: strona wydarzenia, RSVP, prezenty. */
export const publicRouter = Router();

const strictLimit = limiter(10);

export async function findPublicWedding(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return prisma.wedding.findFirst({ where: { slug: parsed.data, deletedAt: null } });
}

async function requireWedding(slug: string) {
  const w = await findPublicWedding(slug);
  if (!w) throw notFound();
  return w;
}

const serializePart = (p: { id: string; name: string; startsAt: Date; endsAt: Date | null; locationName: string | null; address: string | null; mapUrl: string | null; notes: string | null }) => ({
  id: p.id,
  name: p.name,
  startsAt: dateToWallClock(p.startsAt),
  endsAt: p.endsAt ? dateToWallClock(p.endsAt) : null,
  locationName: p.locationName,
  address: p.address,
  mapUrl: p.mapUrl,
  notes: p.notes,
});

function rsvpOpen(w: { rsvpDeadline: Date | null; timezone: string }) {
  return !w.rsvpDeadline || todayIn(w.timezone) <= isoDate(w.rsvpDeadline);
}

const consentIp = (ip: string | undefined) => hashIp(ip, env.BETTER_AUTH_SECRET);

// ─── Strona wydarzenia ──────────────────────────────────────────

publicRouter.get("/weddings/:slug", async (req, res) => {
  const w = await requireWedding(param(req, "slug"));
  const [parts, gifts] = await Promise.all([
    prisma.eventPart.findMany({ where: { weddingId: w.id }, orderBy: [{ order: "asc" }, { startsAt: "asc" }] }),
    prisma.gift.findMany({
      where: { weddingId: w.id, hidden: false },
      include: { reservations: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  res.json({
    slug: w.slug,
    partnerOneName: w.partnerOneName,
    partnerTwoName: w.partnerTwoName,
    date: isoDate(w.date),
    locale: w.locale,
    welcomeMessage: w.welcomeMessage,
    rsvpMode: w.rsvpMode,
    rsvpDeadline: w.rsvpDeadline ? isoDate(w.rsvpDeadline) : null,
    rsvpOpen: rsvpOpen(w),
    giftsIntro: w.giftsIntro,
    cashGiftInfo: w.cashGiftInfo,
    showBranding: !PLANS[w.plan].features.removeBranding,
    eventParts: parts.map(serializePart),
    gifts: gifts.map((g) => publicGift(g)),
  });
});

// ─── RSVP: link dedykowany ──────────────────────────────────────

async function loadRsvp(token: string) {
  const household = await prisma.household.findUnique({ where: { token }, include: householdInclude });
  if (!household) throw notFound();
  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: household.weddingId },
    include: { eventParts: { orderBy: [{ order: "asc" }, { startsAt: "asc" }] }, mealOptions: { orderBy: { order: "asc" } } },
  });
  if (wedding.deletedAt) throw notFound();
  return { household, wedding };
}

publicRouter.get("/rsvp/:token", async (req, res) => {
  const { household: h, wedding: w } = await loadRsvp(param(req, "token"));
  const guest = (g: (typeof h.guests)[number] | NonNullable<(typeof h.guests)[number]["plusOne"]>) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    type: g.type,
    age: g.age,
    plusOneAllowed: g.plusOneAllowed,
    mealOptionId: g.mealOptionId,
    dietNotes: g.dietNotes,
    attendance: Object.fromEntries(g.rsvps.map((r) => [r.eventPartId, r.attending])),
  });
  res.json({
    wedding: {
      slug: w.slug,
      partnerOneName: w.partnerOneName,
      partnerTwoName: w.partnerTwoName,
      date: isoDate(w.date),
      locale: w.locale,
      rsvpDeadline: w.rsvpDeadline ? isoDate(w.rsvpDeadline) : null,
      rsvpOpen: rsvpOpen(w),
    },
    household: {
      name: h.name,
      email: h.email,
      locked: h.locked,
      respondedAt: h.respondedAt,
      needsAccommodation: h.needsAccommodation,
      needsTransport: h.needsTransport,
      messageToCouple: h.messageToCouple,
    },
    eventParts: effectiveParts(h, w.eventParts).map(serializePart),
    mealOptions: w.mealOptions
      .filter((o) => o.active)
      .map((o) => ({ id: o.id, name: o.name, description: o.description, forChildren: o.forChildren })),
    guests: h.guests.map((g) => ({ ...guest(g), plusOne: g.plusOne ? guest(g.plusOne) : null })),
  });
});

publicRouter.post("/rsvp/:token", strictLimit, async (req, res) => {
  const input = rsvpSubmitSchema.parse(req.body);
  const { household, wedding } = await loadRsvp(param(req, "token"));
  if (household.locked) throw conflict("rsvp_locked");
  if (!rsvpOpen(wedding)) throw new HttpError(403, "rsvp_closed");

  const plan = await applyRsvp(household, wedding, input);
  const email = input.email ?? household.email;
  await prisma.consentLog.create({
    data: {
      weddingId: wedding.id,
      householdId: household.id,
      kind: "RSVP",
      email,
      textVersion: CONSENT_TEXT_VERSION,
      ipHash: consentIp(req.ip),
    },
  });
  const locale = typeof req.query.lang === "string" ? req.query.lang : wedding.locale;
  sendRsvpConfirmation(wedding, { ...household, email }, plan, locale);
  res.json({ ok: true });
});

// ─── RSVP: tryb otwarty ─────────────────────────────────────────

function assertOpenMode(w: { rsvpMode: string }) {
  if (w.rsvpMode === "DEDICATED") throw notFound();
}

/**
 * Szukanie po imieniu i nazwisku. Zwraca link do formularza gospodarstwa.
 * Decyzja produktowa: dopasowanie wystarcza, bez dodatkowej weryfikacji.
 * Etykieta ujawnia tylko imiona i inicjały nazwisk domowników.
 */
publicRouter.post("/weddings/:slug/rsvp-search", strictLimit, async (req, res) => {
  const query = rsvpSearchSchema.parse(req.body);
  const w = await requireWedding(param(req, "slug"));
  assertOpenMode(w);
  const guests = await prisma.guest.findMany({
    where: { weddingId: w.id, isPlusOne: false },
    select: { id: true, firstName: true, lastName: true, householdId: true },
  });
  const matched = matchGuests(query, guests);
  const householdIds = [...new Set(matched.map((g) => g.householdId))];
  const households = await prisma.household.findMany({
    where: { id: { in: householdIds } },
    select: { id: true, token: true, guests: { where: { isPlusOne: false }, select: { firstName: true, lastName: true } } },
  });
  const byId = new Map(households.map((h) => [h.id, h]));
  res.json(
    householdIds.map((id) => {
      const h = byId.get(id)!;
      return {
        token: h.token,
        label: h.guests.map((g) => `${g.firstName} ${g.lastName.slice(0, 1)}${g.lastName ? "." : ""}`.trim()).join(", "),
      };
    }),
  );
});

publicRouter.post("/weddings/:slug/join-requests", strictLimit, async (req, res) => {
  const input = joinRequestSchema.parse(req.body);
  const w = await requireWedding(param(req, "slug"));
  assertOpenMode(w);
  if (!rsvpOpen(w)) throw new HttpError(403, "rsvp_closed");
  const duplicate = await prisma.joinRequest.findFirst({ where: { weddingId: w.id, email: input.email, status: "PENDING" } });
  if (duplicate) throw conflict("join_request_pending");

  await prisma.$transaction([
    prisma.joinRequest.create({
      data: {
        weddingId: w.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        message: input.message,
        locale: input.locale,
      },
    }),
    prisma.consentLog.create({
      data: { weddingId: w.id, kind: "JOIN_REQUEST", email: input.email, textVersion: CONSENT_TEXT_VERSION, ipHash: consentIp(req.ip) },
    }),
  ]);

  const managers = await prisma.weddingMember.findMany({
    where: { weddingId: w.id, role: { in: ["OWNER", "PARTNER"] } },
    include: { user: true },
  });
  const couple = coupleName(w);
  for (const m of managers) {
    sendMailInBackground({
      to: m.user.email,
      locale: m.user.locale,
      subject: t(m.user.locale, "mail.joinRequest.subject"),
      body: t(m.user.locale, "mail.joinRequest.body", {
        name: `${input.firstName} ${input.lastName}`,
        email: input.email,
        couple,
      }),
      cta: t(m.user.locale, "mail.joinRequest.cta"),
      url: `${env.APP_URL}/app/w/${w.id}/guests`,
    });
  }
  res.status(201).json({ ok: true });
});

// ─── Prezenty ───────────────────────────────────────────────────

publicRouter.post("/weddings/:slug/gifts/:giftId/reserve", strictLimit, async (req, res) => {
  const input = giftReserveSchema.parse(req.body);
  const w = await requireWedding(param(req, "slug"));
  const confirmToken = randomToken();

  const gift = await serializable(async (tx) => {
    const gift = await tx.gift.findFirst({
      where: { id: param(req, "giftId"), weddingId: w.id, hidden: false },
      include: { reservations: true },
    });
    if (!gift) throw notFound();
    const a = giftAvailability(gift, gift.reservations);
    if (!a.available) throw conflict("gift_taken");
    let amountCents: number | null = null;
    if (gift.isGroupGift) {
      if (!input.amount || input.amount <= 0) throw badRequest("amount_required");
      if (input.amount > a.remainingCents!) throw conflict("amount_exceeds_remaining");
      amountCents = input.amount;
    }
    await tx.giftReservation.create({
      data: {
        weddingId: w.id,
        giftId: gift.id,
        name: input.name,
        email: input.email,
        amountCents,
        locale: input.locale,
        confirmToken,
        cancelToken: randomToken(),
        expiresAt: new Date(Date.now() + RESERVATION_PENDING_MINUTES * 60_000),
      },
    });
    await tx.consentLog.create({
      data: { weddingId: w.id, kind: "GIFT_RESERVATION", email: input.email, textVersion: CONSENT_TEXT_VERSION, ipHash: consentIp(req.ip) },
    });
    return gift;
  });

  const couple = coupleName(w);
  sendMailInBackground({
    to: input.email,
    locale: input.locale,
    subject: t(input.locale, "mail.giftConfirm.subject", { gift: gift.title }),
    body: t(input.locale, "mail.giftConfirm.body", { gift: gift.title, couple }),
    cta: t(input.locale, "mail.giftConfirm.cta"),
    url: `${env.APP_URL}/w/${w.slug}/gift?confirm=${confirmToken}`,
  });
  res.status(202).json({ status: "pending_email", expiresInMinutes: RESERVATION_PENDING_MINUTES });
});

publicRouter.post("/gift-reservations/confirm", strictLimit, async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  const result = await serializable(async (tx) => {
    const r = await tx.giftReservation.findUnique({
      where: { confirmToken: token },
      include: { gift: { include: { reservations: true } }, wedding: true },
    });
    if (!r) throw notFound();
    if (r.status === "CANCELLED") throw gone("reservation_cancelled");
    if (r.status === "CONFIRMED") return { r, newlyConfirmed: false };
    // Po wygaśnięciu potwierdzamy tylko, jeśli prezent nadal jest wolny.
    if (r.expiresAt <= new Date()) {
      const others = r.gift.reservations.filter((x) => x.id !== r.id);
      const a = giftAvailability(r.gift, others);
      if (!a.available || (r.gift.isGroupGift && (r.amountCents ?? 0) > a.remainingCents!)) throw conflict("gift_taken");
    }
    await tx.giftReservation.update({ where: { id: r.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    return { r, newlyConfirmed: true };
  });

  const { r } = result;
  if (result.newlyConfirmed) {
    const couple = coupleName(r.wedding);
    sendMailInBackground({
      to: r.email,
      locale: r.locale,
      subject: t(r.locale, "mail.giftConfirmed.subject", { gift: r.gift.title }),
      body: t(r.locale, "mail.giftConfirmed.body", { gift: r.gift.title, couple }),
      cta: t(r.locale, "mail.giftConfirmed.cta"),
      url: `${env.APP_URL}/w/${r.wedding.slug}/gift?cancel=${r.cancelToken}`,
    });
  }
  res.json({ status: "confirmed", giftTitle: r.gift.title, amountCents: r.amountCents });
});

publicRouter.post("/gift-reservations/cancel", strictLimit, async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  const r = await prisma.giftReservation.findUnique({ where: { cancelToken: token }, include: { gift: true } });
  if (!r) throw notFound();
  if (r.status !== "CANCELLED") {
    await prisma.giftReservation.update({ where: { id: r.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  }
  res.json({ status: "cancelled", giftTitle: r.gift.title });
});
