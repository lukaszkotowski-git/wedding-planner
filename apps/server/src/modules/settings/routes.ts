import { childPriceTiersSchema, eventPartSchema, mealOptionSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { dateToWallClock, wallClockToDate } from "../../lib/dates";
import { notFound, param } from "../../lib/http";
import { requireRole } from "../../middleware/auth";

/** Części wydarzenia, opcje menu, progi cenowe dzieci. */
export const settingsRouter = Router({ mergeParams: true });

// ─── Części wydarzenia ──────────────────────────────────────────

const serializePart = (p: Awaited<ReturnType<typeof prisma.eventPart.findFirstOrThrow>>) => ({
  ...p,
  startsAt: dateToWallClock(p.startsAt),
  endsAt: p.endsAt ? dateToWallClock(p.endsAt) : null,
});

settingsRouter.get("/event-parts", async (req, res) => {
  const parts = await prisma.eventPart.findMany({
    where: { weddingId: req.wedding!.id },
    orderBy: [{ order: "asc" }, { startsAt: "asc" }],
  });
  res.json(parts.map(serializePart));
});

settingsRouter.post("/event-parts", requireRole("PARTNER"), async (req, res) => {
  const input = eventPartSchema.parse(req.body);
  const part = await prisma.eventPart.create({
    data: {
      ...input,
      weddingId: req.wedding!.id,
      startsAt: wallClockToDate(input.startsAt),
      endsAt: input.endsAt ? wallClockToDate(input.endsAt) : null,
    },
  });
  res.status(201).json(serializePart(part));
});

settingsRouter.put("/event-parts/:id", requireRole("PARTNER"), async (req, res) => {
  const input = eventPartSchema.parse(req.body);
  const { count } = await prisma.eventPart.updateMany({
    where: { id: param(req, "id"), weddingId: req.wedding!.id },
    data: {
      ...input,
      startsAt: wallClockToDate(input.startsAt),
      endsAt: input.endsAt ? wallClockToDate(input.endsAt) : null,
    },
  });
  if (!count) throw notFound();
  res.json(serializePart(await prisma.eventPart.findUniqueOrThrow({ where: { id: param(req, "id") } })));
});

settingsRouter.delete("/event-parts/:id", requireRole("PARTNER"), async (req, res) => {
  const { count } = await prisma.eventPart.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

// ─── Menu ───────────────────────────────────────────────────────

settingsRouter.get("/meal-options", async (req, res) => {
  res.json(
    await prisma.mealOption.findMany({ where: { weddingId: req.wedding!.id }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
  );
});

settingsRouter.post("/meal-options", requireRole("PARTNER"), async (req, res) => {
  const input = mealOptionSchema.parse(req.body);
  res.status(201).json(await prisma.mealOption.create({ data: { ...input, weddingId: req.wedding!.id } }));
});

settingsRouter.put("/meal-options/:id", requireRole("PARTNER"), async (req, res) => {
  const input = mealOptionSchema.parse(req.body);
  const { count } = await prisma.mealOption.updateMany({
    where: { id: param(req, "id"), weddingId: req.wedding!.id },
    data: input,
  });
  if (!count) throw notFound();
  res.json(await prisma.mealOption.findUniqueOrThrow({ where: { id: param(req, "id") } }));
});

/** Usunięcie opcji wybranej już przez gości zeruje ich wybór; UI proponuje najpierw dezaktywację. */
settingsRouter.delete("/meal-options/:id", requireRole("PARTNER"), async (req, res) => {
  const { count } = await prisma.mealOption.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

// ─── Progi cenowe dzieci ────────────────────────────────────────

settingsRouter.get("/child-tiers", async (req, res) => {
  res.json(await prisma.childPriceTier.findMany({ where: { weddingId: req.wedding!.id }, orderBy: { fromAge: "asc" } }));
});

/** Zastępuje cały zestaw progów (mała lista, edytowana jako całość). */
settingsRouter.put("/child-tiers", requireRole("PARTNER"), async (req, res) => {
  const tiers = childPriceTiersSchema.parse(req.body);
  const weddingId = req.wedding!.id;
  await prisma.$transaction([
    prisma.childPriceTier.deleteMany({ where: { weddingId } }),
    prisma.childPriceTier.createMany({ data: tiers.map((t) => ({ ...t, weddingId })) }),
  ]);
  res.json(await prisma.childPriceTier.findMany({ where: { weddingId }, orderBy: { fromAge: "asc" } }));
});
