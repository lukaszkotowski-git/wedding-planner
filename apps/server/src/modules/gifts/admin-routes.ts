import { hasRole, giftInputSchema } from "@wedding/shared";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/db";
import { badRequest, notFound, param } from "../../lib/http";
import { assertFeature, assertWithinLimit } from "../../lib/plan";
import { deleteObject, storeImage } from "../../lib/storage";
import { requireRole } from "../../middleware/auth";
import { adminGift } from "./service";

export const giftsAdminRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.mimetype)),
});

const include = { reservations: true } as const;

async function loadGift(weddingId: string, id: string) {
  const g = await prisma.gift.findFirst({ where: { id, weddingId }, include });
  if (!g) throw notFound();
  return g;
}

/** CO_PLANNER widzi status rezerwacji, ale nie kto rezerwował (to wie tylko para). */
const canSeeReservers = (req: Express.Request) => hasRole(req.weddingRole!, "PARTNER");

giftsAdminRouter.get("/", async (req, res) => {
  const gifts = await prisma.gift.findMany({
    where: { weddingId: req.wedding!.id },
    include,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  res.json(gifts.map((g) => adminGift(g, canSeeReservers(req))));
});

giftsAdminRouter.post("/", requireRole("CO_PLANNER"), async (req, res) => {
  const input = giftInputSchema.parse(req.body);
  const wedding = req.wedding!;
  if (input.isGroupGift) assertFeature(wedding, "groupGifts");
  assertWithinLimit(wedding, "gifts", (await prisma.gift.count({ where: { weddingId: wedding.id } })) + 1);
  const gift = await prisma.gift.create({ data: { ...input, weddingId: wedding.id }, include });
  res.status(201).json(adminGift(gift, canSeeReservers(req)));
});

giftsAdminRouter.put("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const input = giftInputSchema.parse(req.body);
  const existing = await loadGift(req.wedding!.id, param(req, "id"));
  if (input.isGroupGift && !existing.isGroupGift) assertFeature(req.wedding!, "groupGifts");
  const hasActive = adminGift(existing, false).reservations.length > 0;
  if (hasActive && input.isGroupGift !== existing.isGroupGift) throw badRequest("gift_has_reservations");
  const gift = await prisma.gift.update({ where: { id: existing.id }, data: input, include });
  res.json(adminGift(gift, canSeeReservers(req)));
});

giftsAdminRouter.delete("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const gift = await loadGift(req.wedding!.id, param(req, "id"));
  await prisma.gift.delete({ where: { id: gift.id } });
  if (gift.imageKey) await deleteObject(gift.imageKey);
  res.status(204).end();
});

giftsAdminRouter.post("/:id/image", requireRole("CO_PLANNER"), upload.single("image"), async (req, res) => {
  const gift = await loadGift(req.wedding!.id, param(req, "id"));
  if (!req.file) throw badRequest("image_required");
  let key: string;
  try {
    key = await storeImage(`weddings/${req.wedding!.id}/gifts`, req.file.buffer);
  } catch (e) {
    if (e instanceof Error && /unsupported image format|Input buffer/i.test(e.message)) throw badRequest("invalid_image");
    throw e;
  }
  const updated = await prisma.gift.update({ where: { id: gift.id }, data: { imageKey: key }, include });
  if (gift.imageKey) await deleteObject(gift.imageKey);
  res.json(adminGift(updated, canSeeReservers(req)));
});

giftsAdminRouter.delete("/:id/image", requireRole("CO_PLANNER"), async (req, res) => {
  const gift = await loadGift(req.wedding!.id, param(req, "id"));
  const updated = await prisma.gift.update({ where: { id: gift.id }, data: { imageKey: null }, include });
  if (gift.imageKey) await deleteObject(gift.imageKey);
  res.json(adminGift(updated, canSeeReservers(req)));
});

/** Para anuluje rezerwację (np. gość poprosił telefonicznie). */
giftsAdminRouter.delete("/:id/reservations/:rid", requireRole("PARTNER"), async (req, res) => {
  const { count } = await prisma.giftReservation.updateMany({
    where: { id: param(req, "rid"), giftId: param(req, "id"), weddingId: req.wedding!.id, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (!count) throw notFound();
  res.status(204).end();
});
