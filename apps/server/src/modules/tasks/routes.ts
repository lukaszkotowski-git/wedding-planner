import type { Task, Assignee } from "@prisma/client";
import { assigneeSchema, taskInputSchema, taskPatchSchema } from "@wedding/shared";
import { Router } from "express";
import { prisma } from "../../lib/db";
import { isoDate } from "../../lib/dates";
import { badRequest, notFound, param } from "../../lib/http";
import { requireRole } from "../../middleware/auth";
import { ensureDefaultAssignees, generateTemplateTasks } from "./service";

export const tasksRouter = Router({ mergeParams: true });

const serialize = (t: Task & { assignee: Assignee | null }) => ({
  id: t.id,
  templateKey: t.templateKey,
  title: t.title,
  description: t.description,
  category: t.category,
  dueDate: t.dueDate ? isoDate(t.dueDate) : null,
  dueMode: t.dueMode,
  status: t.status,
  doneAt: t.doneAt,
  assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
});

const include = { assignee: true } as const;

async function assertAssignee(weddingId: string, assigneeId: string | null | undefined) {
  if (assigneeId && !(await prisma.assignee.count({ where: { id: assigneeId, weddingId } }))) throw badRequest("invalid_reference");
}

tasksRouter.get("/", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { weddingId: req.wedding!.id },
    include,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  res.json(tasks.map(serialize));
});

tasksRouter.post("/", requireRole("CO_PLANNER"), async (req, res) => {
  const input = taskInputSchema.parse(req.body);
  await assertAssignee(req.wedding!.id, input.assigneeId);
  const task = await prisma.task.create({
    data: {
      ...input,
      weddingId: req.wedding!.id,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      dueMode: "FIXED",
      doneAt: input.status === "DONE" ? new Date() : null,
    },
    include,
  });
  res.status(201).json(serialize(task));
});

tasksRouter.put("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const input = taskInputSchema.parse(req.body);
  const existing = await prisma.task.findFirst({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!existing) throw notFound();
  await assertAssignee(req.wedding!.id, input.assigneeId);
  // Ręczna zmiana terminu odpina zadanie od daty ślubu.
  const dateChanged = (existing.dueDate ? isoDate(existing.dueDate) : null) !== input.dueDate;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      dueMode: dateChanged ? "FIXED" : existing.dueMode,
      doneAt: input.status === "DONE" ? (existing.doneAt ?? new Date()) : null,
    },
    include,
  });
  res.json(serialize(task));
});

/** Szybka zmiana statusu / osoby z listy (checkbox). */
tasksRouter.patch("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const input = taskPatchSchema.parse(req.body);
  const existing = await prisma.task.findFirst({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!existing) throw notFound();
  if (input.assigneeId !== undefined) await assertAssignee(req.wedding!.id, input.assigneeId);
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...(input.status && { status: input.status, doneAt: input.status === "DONE" ? (existing.doneAt ?? new Date()) : null }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId || null }),
    },
    include,
  });
  res.json(serialize(task));
});

tasksRouter.delete("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const { count } = await prisma.task.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

/** Dodaje brakujące standardowe zadania (np. po zmianie typu ceremonii lub dla wesel sprzed tej funkcji). */
tasksRouter.post("/generate", requireRole("CO_PLANNER"), async (req, res) => {
  const created = await generateTemplateTasks(prisma, req.wedding!);
  await ensureDefaultAssignees(prisma, req.wedding!);
  res.json({ created });
});

// ─── Osoby ──────────────────────────────────────────────────────

export const assigneesRouter = Router({ mergeParams: true });

assigneesRouter.get("/", async (req, res) => {
  res.json(await prisma.assignee.findMany({ where: { weddingId: req.wedding!.id }, orderBy: [{ order: "asc" }, { name: "asc" }] }));
});

assigneesRouter.post("/", requireRole("CO_PLANNER"), async (req, res) => {
  const { name } = assigneeSchema.parse(req.body);
  const order = await prisma.assignee.count({ where: { weddingId: req.wedding!.id } });
  res.status(201).json(await prisma.assignee.create({ data: { weddingId: req.wedding!.id, name, order } }));
});

assigneesRouter.put("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const { name } = assigneeSchema.parse(req.body);
  const { count } = await prisma.assignee.updateMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id }, data: { name } });
  if (!count) throw notFound();
  res.json({ ok: true });
});

assigneesRouter.delete("/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const { count } = await prisma.assignee.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});
