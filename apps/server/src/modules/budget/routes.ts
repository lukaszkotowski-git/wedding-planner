import { budgetCategorySchema, expenseInputSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound, param } from "../../lib/http";
import { requireFeature } from "../../lib/plan";
import { requireRole } from "../../middleware/auth";
import { createDefaultBudgetCategories } from "../tasks/service";
import { budgetOverview } from "./service";

/** Budżet widzi tylko para (PARTNER+): kwoty to dane wrażliwe także wobec świadków. */
export const budgetRouter = Router({ mergeParams: true });
budgetRouter.use(requireFeature("budget"), requireRole("PARTNER"));

budgetRouter.get("/", async (req, res) => {
  res.json(await budgetOverview(req.wedding!.id, req.wedding!.platePriceCents));
});

budgetRouter.post("/categories/defaults", async (req, res) => {
  if (await prisma.budgetCategory.count({ where: { weddingId: req.wedding!.id } })) throw conflict("categories_exist");
  await createDefaultBudgetCategories(prisma, req.wedding!);
  res.status(201).json({ ok: true });
});

budgetRouter.post("/categories", async (req, res) => {
  const { planned, ...input } = budgetCategorySchema.parse(req.body);
  const c = await prisma.budgetCategory.create({ data: { ...input, plannedCents: planned, weddingId: req.wedding!.id } });
  res.status(201).json(c);
});

budgetRouter.put("/categories/:id", async (req, res) => {
  const { planned, ...input } = budgetCategorySchema.parse(req.body);
  const { count } = await prisma.budgetCategory.updateMany({
    where: { id: param(req, "id"), weddingId: req.wedding!.id },
    data: { ...input, plannedCents: planned },
  });
  if (!count) throw notFound();
  res.json({ ok: true });
});

budgetRouter.delete("/categories/:id", async (req, res) => {
  const { count } = await prisma.budgetCategory.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

async function assertRefs(weddingId: string, categoryId: string, vendorId: string | null) {
  const [cat, vendor] = await Promise.all([
    prisma.budgetCategory.count({ where: { id: categoryId, weddingId } }),
    vendorId ? prisma.vendor.count({ where: { id: vendorId, weddingId } }) : 1,
  ]);
  if (!cat || !vendor) throw badRequest("invalid_reference");
}

const paymentData = (p: { amount: number; dueDate: string | null; paidAt: string | null; note: string | null }) => ({
  amountCents: p.amount,
  dueDate: p.dueDate ? new Date(p.dueDate) : null,
  paidAt: p.paidAt ? new Date(p.paidAt) : null,
  note: p.note,
});

budgetRouter.post("/expenses", async (req, res) => {
  const { payments, amount, ...input } = expenseInputSchema.parse(req.body);
  const weddingId = req.wedding!.id;
  await assertRefs(weddingId, input.categoryId, input.vendorId);
  const e = await prisma.expense.create({
    data: {
      ...input,
      amountCents: amount,
      weddingId,
      payments: { create: payments.map((p) => ({ ...paymentData(p), weddingId })) },
    },
  });
  res.status(201).json({ id: e.id });
});

/** Koszt edytowany razem z ratami: raty spoza listy są usuwane. */
budgetRouter.put("/expenses/:id", async (req, res) => {
  const { payments, amount, ...input } = expenseInputSchema.parse(req.body);
  const weddingId = req.wedding!.id;
  const existing = await prisma.expense.findFirst({ where: { id: param(req, "id"), weddingId }, include: { payments: true } });
  if (!existing) throw notFound();
  await assertRefs(weddingId, input.categoryId, input.vendorId);
  const ownIds = new Set(existing.payments.map((p) => p.id));
  if (payments.some((p) => p.id && !ownIds.has(p.id))) throw badRequest("invalid_reference");
  const kept = payments.flatMap((p) => p.id ?? []);

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { expenseId: existing.id, id: { notIn: kept } } });
    for (const p of payments) {
      if (p.id) await tx.payment.update({ where: { id: p.id }, data: paymentData(p) });
      else await tx.payment.create({ data: { ...paymentData(p), expenseId: existing.id, weddingId } });
    }
    await tx.expense.update({ where: { id: existing.id }, data: { ...input, amountCents: amount } });
  });
  res.json({ ok: true });
});

budgetRouter.delete("/expenses/:id", async (req, res) => {
  const { count } = await prisma.expense.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});
