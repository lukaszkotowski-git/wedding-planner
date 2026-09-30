import { Prisma } from "@prisma/client";
import { createWeddingSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { conflict } from "../../lib/http";
import { requireAuth, requireWeddingRole } from "../../middleware/auth";

export const weddingsRouter = Router();

weddingsRouter.use(requireAuth);

weddingsRouter.get("/", async (req, res) => {
  const memberships = await prisma.weddingMember.findMany({
    where: { userId: req.user!.id, wedding: { deletedAt: null } },
    include: { wedding: true },
    orderBy: { wedding: { date: "asc" } },
  });
  res.json(memberships.map((m) => ({ ...serialize(m.wedding), role: m.role })));
});

weddingsRouter.post("/", async (req, res) => {
  const input = createWeddingSchema.parse(req.body);
  try {
    const wedding = await prisma.wedding.create({
      data: {
        slug: input.slug,
        partnerOneName: input.partnerOneName,
        partnerTwoName: input.partnerTwoName,
        date: new Date(input.date),
        ceremonyType: input.ceremonyType,
        locale: input.locale,
        members: { create: { userId: req.user!.id, role: "OWNER" } },
      },
    });
    res.status(201).json({ ...serialize(wedding), role: "OWNER" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("slug_taken");
    throw e;
  }
});

weddingsRouter.get("/:weddingId", requireWeddingRole("VIEWER"), (req, res) => {
  res.json({ ...serialize(req.wedding!), role: req.weddingRole });
});

function serialize(w: Prisma.WeddingGetPayload<object>) {
  return {
    id: w.id,
    slug: w.slug,
    partnerOneName: w.partnerOneName,
    partnerTwoName: w.partnerTwoName,
    date: w.date.toISOString().slice(0, 10),
    ceremonyType: w.ceremonyType,
    locale: w.locale,
    plan: w.plan,
  };
}
