import type { Vendor } from "@prisma/client";
import { vendorInputSchema } from "@wedding/shared";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/db";
import { badRequest, notFound, param } from "../../lib/http";
import { requireFeature } from "../../lib/plan";
import { deleteObject, readObject, storeFile } from "../../lib/storage";
import { requireRole } from "../../middleware/auth";

export const vendorsRouter = Router({ mergeParams: true });
vendorsRouter.use(requireFeature("vendors"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const serialize = (v: Vendor) => {
  const { contractKey, weddingId: _w, ...rest } = v;
  return { ...rest, hasContract: !!contractKey };
};

async function loadVendor(weddingId: string, id: string) {
  const v = await prisma.vendor.findFirst({ where: { id, weddingId } });
  if (!v) throw notFound();
  return v;
}

vendorsRouter.get("/", async (req, res) => {
  const vendors = await prisma.vendor.findMany({ where: { weddingId: req.wedding!.id }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  res.json(vendors.map(serialize));
});

vendorsRouter.post("/", requireRole("CO_PLANNER"), async (req, res) => {
  const input = vendorInputSchema.parse(req.body);
  res.status(201).json(serialize(await prisma.vendor.create({ data: { ...input, weddingId: req.wedding!.id } })));
});

vendorsRouter.put("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const input = vendorInputSchema.parse(req.body);
  const v = await loadVendor(req.wedding!.id, param(req, "id"));
  res.json(serialize(await prisma.vendor.update({ where: { id: v.id }, data: input })));
});

vendorsRouter.delete("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const v = await loadVendor(req.wedding!.id, param(req, "id"));
  await prisma.vendor.delete({ where: { id: v.id } });
  if (v.contractKey) await deleteObject(v.contractKey);
  res.status(204).end();
});

/** Umowa to dokument poufny: tylko PDF, bez publicznego adresu, pobieranie wyłącznie przez członków wesela. */
vendorsRouter.post("/:id/contract", requireRole("CO_PLANNER"), upload.single("file"), async (req, res) => {
  const v = await loadVendor(req.wedding!.id, param(req, "id"));
  const file = req.file;
  if (!file || file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw badRequest("invalid_pdf");
  const key = await storeFile(`weddings/${req.wedding!.id}/contracts`, file.buffer, "application/pdf", "pdf");
  const name = file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "umowa.pdf";
  const updated = await prisma.vendor.update({ where: { id: v.id }, data: { contractKey: key, contractName: name } });
  if (v.contractKey) await deleteObject(v.contractKey);
  res.json(serialize(updated));
});

vendorsRouter.get("/:id/contract", async (req, res) => {
  const v = await loadVendor(req.wedding!.id, param(req, "id"));
  if (!v.contractKey) throw notFound();
  const obj = await readObject(v.contractKey);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(v.contractName ?? "umowa.pdf")}`,
    "Cache-Control": "private, no-store",
  });
  obj.body.pipe(res);
});

vendorsRouter.delete("/:id/contract", requireRole("CO_PLANNER"), async (req, res) => {
  const v = await loadVendor(req.wedding!.id, param(req, "id"));
  const updated = await prisma.vendor.update({ where: { id: v.id }, data: { contractKey: null, contractName: null } });
  if (v.contractKey) await deleteObject(v.contractKey);
  res.json(serialize(updated));
});
