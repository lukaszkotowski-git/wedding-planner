import { Prisma } from "@prisma/client";
import { createWeddingSchema, updateWeddingSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { wallClockToDate } from "../../lib/dates";
import { conflict } from "../../lib/http";
import { t } from "../../lib/i18n";
import { requireAuth, requireRole, requireWeddingRole } from "../../middleware/auth";
import { exportRouter } from "../export/routes";
import { giftsAdminRouter } from "../gifts/admin-routes";
import { householdsRouter, joinRequestsAdminRouter } from "../guests/admin-routes";
import { settingsRouter } from "../settings/routes";
import { statsRouter } from "../stats/routes";
import { teamRouter } from "../team/routes";
import { serializeWedding } from "./serialize";

export const weddingsRouter = Router();

weddingsRouter.use(requireAuth);

weddingsRouter.get("/", async (req, res) => {
  const memberships = await prisma.weddingMember.findMany({
    where: { userId: req.user!.id, wedding: { deletedAt: null } },
    include: { wedding: true },
    orderBy: { wedding: { date: "asc" } },
  });
  res.json(memberships.map((m) => ({ ...serializeWedding(m.wedding), role: m.role })));
});

weddingsRouter.post("/", async (req, res) => {
  const input = createWeddingSchema.parse(req.body);
  const l = input.locale;
  try {
    const wedding = await prisma.wedding.create({
      data: {
        slug: input.slug,
        partnerOneName: input.partnerOneName,
        partnerTwoName: input.partnerTwoName,
        date: new Date(input.date),
        ceremonyType: input.ceremonyType,
        locale: l,
        members: { create: { userId: req.user!.id, role: "OWNER" } },
        // Rozsądne domyślne dane: para od razu może wysłać zaproszenia i tylko je poprawia.
        eventParts: {
          create: [
            { name: t(l, "defaults.parts.ceremony"), startsAt: wallClockToDate(`${input.date}T15:00`), order: 0 },
            { name: t(l, "defaults.parts.reception"), startsAt: wallClockToDate(`${input.date}T17:00`), order: 1 },
          ],
        },
        mealOptions: {
          create: [
            { name: t(l, "defaults.meals.meat"), order: 0 },
            { name: t(l, "defaults.meals.vegetarian"), order: 1 },
            { name: t(l, "defaults.meals.kids"), forChildren: true, order: 2 },
          ],
        },
        childPriceTiers: {
          create: [
            { fromAge: 0, toAge: 3, pricePercent: 0 },
            { fromAge: 4, toAge: 12, pricePercent: 50 },
          ],
        },
      },
    });
    res.status(201).json({ ...serializeWedding(wedding), role: "OWNER" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("slug_taken");
    throw e;
  }
});

// Wszystko poniżej: wesele w kontekście (req.wedding), minimum rola VIEWER; zapisy mają własne wymagania.
const wedding = Router({ mergeParams: true });
weddingsRouter.use("/:weddingId", requireWeddingRole("VIEWER"), wedding);

wedding.get("/", (req, res) => {
  res.json({ ...serializeWedding(req.wedding!), role: req.weddingRole });
});

wedding.patch("/", requireRole("PARTNER"), async (req, res) => {
  const input = updateWeddingSchema.parse(req.body);
  try {
    const updated = await prisma.wedding.update({
      where: { id: req.wedding!.id },
      data: {
        ...input,
        date: new Date(input.date),
        rsvpDeadline: input.rsvpDeadline ? new Date(input.rsvpDeadline) : null,
      },
    });
    res.json({ ...serializeWedding(updated), role: req.weddingRole });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("slug_taken");
    throw e;
  }
});

wedding.use(settingsRouter);
wedding.use("/households", householdsRouter);
wedding.use("/join-requests", joinRequestsAdminRouter);
wedding.use("/gifts", giftsAdminRouter);
wedding.use("/team", teamRouter);
wedding.use("/stats", statsRouter);
wedding.use("/export", exportRouter);
