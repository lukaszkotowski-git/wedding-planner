import { householdInputSchema } from "@wedding/shared";
import { Router } from "express";
import QRCode from "qrcode";
import { env } from "../../env";
import { prisma } from "../../lib/db";
import { badRequest, notFound, param } from "../../lib/http";
import { t } from "../../lib/i18n";
import { sendMailInBackground } from "../../lib/mail";
import { assertWithinLimit, guestSlots } from "../../lib/plan";
import { randomToken } from "../../lib/tokens";
import { requireRole } from "../../middleware/auth";
import { coupleName } from "../weddings/serialize";
import {
  adminRsvpSchema,
  applyRsvp,
  guestSlotsOf,
  householdInclude,
  rsvpUrl,
  serializeHousehold,
} from "./service";

export const householdsRouter = Router({ mergeParams: true });

async function loadHousehold(weddingId: string, id: string) {
  const h = await prisma.household.findFirst({ where: { id, weddingId }, include: householdInclude });
  if (!h) throw notFound();
  return h;
}

/** Id części i opcji menu z formularza muszą należeć do tego wesela. */
async function assertOwnedRefs(weddingId: string, partIds: string[], mealIds: string[]) {
  const [parts, meals] = await Promise.all([
    partIds.length ? prisma.eventPart.count({ where: { weddingId, id: { in: partIds } } }) : 0,
    mealIds.length ? prisma.mealOption.count({ where: { weddingId, id: { in: mealIds } } }) : 0,
  ]);
  if (parts !== new Set(partIds).size || meals !== new Set(mealIds).size) throw badRequest("invalid_reference");
}

householdsRouter.get("/", async (req, res) => {
  const list = await prisma.household.findMany({
    where: { weddingId: req.wedding!.id },
    include: householdInclude,
    orderBy: { createdAt: "asc" },
  });
  res.json(list.map((h) => serializeHousehold(h, req.wedding!.slug)));
});

householdsRouter.post("/", requireRole("CO_PLANNER"), async (req, res) => {
  const input = householdInputSchema.parse(req.body);
  const wedding = req.wedding!;
  await assertOwnedRefs(wedding.id, input.invitedPartIds, input.guests.flatMap((g) => g.mealOptionId ?? []));
  assertWithinLimit(wedding, "guests", (await guestSlots(wedding.id)) + guestSlotsOf(input.guests));

  const { guests, invitedPartIds, ...data } = input;
  const created = await prisma.household.create({
    data: {
      ...data,
      weddingId: wedding.id,
      token: randomToken(),
      invitedParts: { connect: invitedPartIds.map((id) => ({ id })) },
      guests: {
        create: guests.map(({ id: _id, ...g }, order) => ({ ...g, weddingId: wedding.id, order })),
      },
    },
    include: householdInclude,
  });
  res.status(201).json(serializeHousehold(created, wedding.slug));
});

householdsRouter.put("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const input = householdInputSchema.parse(req.body);
  const wedding = req.wedding!;
  const existing = await loadHousehold(wedding.id, param(req, "id"));
  await assertOwnedRefs(wedding.id, input.invitedPartIds, input.guests.flatMap((g) => g.mealOptionId ?? []));
  assertWithinLimit(wedding, "guests", (await guestSlots(wedding.id, existing.id)) + guestSlotsOf(input.guests));

  const existingIds = new Set(existing.guests.map((g) => g.id));
  if (input.guests.some((g) => g.id && !existingIds.has(g.id))) throw badRequest("invalid_reference");
  const keptIds = new Set(input.guests.flatMap((g) => g.id ?? []));

  const { guests, invitedPartIds, ...data } = input;
  await prisma.$transaction(async (tx) => {
    await tx.guest.deleteMany({ where: { householdId: existing.id, isPlusOne: false, id: { notIn: [...keptIds] } } });
    for (const [order, { id, ...g }] of guests.entries()) {
      if (id) {
        await tx.guest.update({ where: { id }, data: { ...g, order } });
        // Cofnięcie zgody na osobę towarzyszącą usuwa już dopisaną osobę.
        if (!g.plusOneAllowed) await tx.guest.deleteMany({ where: { plusOneOfId: id } });
      } else {
        await tx.guest.create({ data: { ...g, order, weddingId: wedding.id, householdId: existing.id } });
      }
    }
    await tx.household.update({
      where: { id: existing.id },
      data: { ...data, invitedParts: { set: invitedPartIds.map((id) => ({ id })) } },
    });
  });
  res.json(serializeHousehold(await loadHousehold(wedding.id, existing.id), wedding.slug));
});

householdsRouter.delete("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const { count } = await prisma.household.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

/** Pozwala gościowi ponownie wysłać odpowiedź. */
householdsRouter.post("/:id/unlock", requireRole("CO_PLANNER"), async (req, res) => {
  const h = await loadHousehold(req.wedding!.id, param(req, "id"));
  await prisma.household.update({ where: { id: h.id }, data: { locked: false } });
  res.json(serializeHousehold({ ...h, locked: false }, req.wedding!.slug));
});

/** Ręczna edycja odpowiedzi przez parę (np. gość zadzwonił). */
householdsRouter.put("/:id/rsvp", requireRole("CO_PLANNER"), async (req, res) => {
  const input = adminRsvpSchema.parse(req.body);
  const h = await loadHousehold(req.wedding!.id, param(req, "id"));
  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: req.wedding!.id },
    include: { eventParts: { orderBy: { order: "asc" } }, mealOptions: true },
  });
  await applyRsvp(h, wedding, input);
  res.json(serializeHousehold(await loadHousehold(wedding.id, h.id), wedding.slug));
});

/** Unieważnia stary link (np. wysłany pod zły adres). */
householdsRouter.post("/:id/regenerate-token", requireRole("CO_PLANNER"), async (req, res) => {
  const h = await loadHousehold(req.wedding!.id, param(req, "id"));
  const token = randomToken();
  await prisma.household.update({ where: { id: h.id }, data: { token } });
  res.json(serializeHousehold({ ...h, token }, req.wedding!.slug));
});

householdsRouter.get("/:id/qr.svg", async (req, res) => {
  const h = await loadHousehold(req.wedding!.id, param(req, "id"));
  const svg = await QRCode.toString(rsvpUrl(req.wedding!.slug, h.token), { type: "svg", margin: 1, width: 512 });
  res.type("image/svg+xml").set("Content-Disposition", `inline; filename="rsvp-qr.svg"`).send(svg);
});

// ─── Prośby o dołączenie (tryb otwarty) ─────────────────────────

export const joinRequestsAdminRouter = Router({ mergeParams: true });

joinRequestsAdminRouter.get("/", async (req, res) => {
  res.json(
    await prisma.joinRequest.findMany({
      where: { weddingId: req.wedding!.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  );
});

joinRequestsAdminRouter.post("/:id/approve", requireRole("CO_PLANNER"), async (req, res) => {
  const wedding = req.wedding!;
  const jr = await prisma.joinRequest.findFirst({ where: { id: param(req, "id"), weddingId: wedding.id } });
  if (!jr) throw notFound();
  if (jr.status !== "PENDING") throw badRequest("already_decided");
  assertWithinLimit(wedding, "guests", (await guestSlots(wedding.id)) + 1);

  const token = randomToken();
  await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        weddingId: wedding.id,
        name: `${jr.firstName} ${jr.lastName}`,
        email: jr.email,
        token,
        source: "OPEN_FORM",
        notes: jr.message,
        guests: { create: { weddingId: wedding.id, firstName: jr.firstName, lastName: jr.lastName } },
      },
    });
    await tx.joinRequest.update({
      where: { id: jr.id },
      data: { status: "APPROVED", decidedAt: new Date(), householdId: household.id },
    });
  });

  const couple = coupleName(wedding);
  sendMailInBackground({
    to: jr.email,
    locale: jr.locale,
    subject: t(jr.locale, "mail.joinApproved.subject", { couple }),
    body: t(jr.locale, "mail.joinApproved.body"),
    cta: t(jr.locale, "mail.joinApproved.cta"),
    url: rsvpUrl(wedding.slug, token),
  });
  res.json({ ok: true });
});

joinRequestsAdminRouter.post("/:id/reject", requireRole("CO_PLANNER"), async (req, res) => {
  const { count } = await prisma.joinRequest.updateMany({
    where: { id: param(req, "id"), weddingId: req.wedding!.id, status: "PENDING" },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  if (!count) throw notFound();
  res.json({ ok: true });
});

export const panelUrl = (weddingId: string) => `${env.APP_URL}/app/w/${weddingId}/guests`;
