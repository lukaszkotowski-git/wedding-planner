import { slugSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { notFound } from "../../lib/http";

/** Endpointy dostępne bez logowania (strona wydarzenia, później RSVP i prezenty). */
export const publicRouter = Router();

export async function findPublicWedding(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return prisma.wedding.findFirst({
    where: { slug: parsed.data, deletedAt: null },
    select: { slug: true, partnerOneName: true, partnerTwoName: true, date: true, locale: true },
  });
}

publicRouter.get("/weddings/:slug", async (req, res) => {
  const w = await findPublicWedding(req.params.slug);
  if (!w) throw notFound();
  res.json({ ...w, date: w.date.toISOString().slice(0, 10) });
});
