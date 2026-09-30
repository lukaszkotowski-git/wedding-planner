import { PLANS, calendarEntrySchema, hasRole } from "@wedding/shared";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { dateToWallClock, isoDate, wallClockToDate } from "../../lib/dates";
import { badRequest, notFound, param } from "../../lib/http";
import { requireRole } from "../../middleware/auth";

export const calendarRouter = Router({ mergeParams: true });

export type CalendarItemKind = "PART" | "TASK" | "PAYMENT" | "ENTRY";

export interface CalendarItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (czas ścienny), brak = całodniowe */
  time: string | null;
  endTime: string | null;
  done: boolean;
  location: string | null;
  notes: string | null;
  /** id źródła (zadanie, rata, spotkanie) */
  refId: string;
}

const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() }).refine((r) => r.from <= r.to);

/**
 * Jeden widok czasu: części wesela, terminy zadań, raty (tylko dla pary, jeśli budżet w pakiecie) i spotkania.
 * Zakres włącznie, daty ścienne.
 */
calendarRouter.get("/", async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const w = req.wedding!;
  const dayRange = { gte: new Date(from), lte: new Date(to) };
  const timeRange = { gte: wallClockToDate(`${from}T00:00`), lte: wallClockToDate(`${to}T23:59`) };
  const showPayments = hasRole(req.weddingRole!, "PARTNER") && PLANS[w.plan].features.budget;

  const [parts, tasks, entries, payments] = await Promise.all([
    prisma.eventPart.findMany({ where: { weddingId: w.id, startsAt: timeRange } }),
    prisma.task.findMany({ where: { weddingId: w.id, dueDate: dayRange } }),
    prisma.calendarEntry.findMany({ where: { weddingId: w.id, startsAt: timeRange }, include: { vendor: { select: { name: true } } } }),
    showPayments
      ? prisma.payment.findMany({ where: { weddingId: w.id, dueDate: dayRange }, include: { expense: { select: { title: true } } } })
      : [],
  ]);

  const time = (d: Date) => dateToWallClock(d).slice(11);
  const items: CalendarItem[] = [
    ...parts.map((p) => ({
      id: `part-${p.id}`,
      kind: "PART" as const,
      title: p.name,
      date: dateToWallClock(p.startsAt).slice(0, 10),
      time: time(p.startsAt),
      endTime: p.endsAt ? time(p.endsAt) : null,
      done: false,
      location: [p.locationName, p.address].filter(Boolean).join(", ") || null,
      notes: p.notes,
      refId: p.id,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "TASK" as const,
      title: t.title,
      date: isoDate(t.dueDate!),
      time: null,
      endTime: null,
      done: t.status === "DONE",
      location: null,
      notes: null,
      refId: t.id,
    })),
    ...entries.map((e) => ({
      id: `entry-${e.id}`,
      kind: "ENTRY" as const,
      title: e.vendor ? `${e.title} (${e.vendor.name})` : e.title,
      date: dateToWallClock(e.startsAt).slice(0, 10),
      time: time(e.startsAt),
      endTime: e.endsAt ? time(e.endsAt) : null,
      done: false,
      location: e.location,
      notes: e.notes,
      refId: e.id,
    })),
    ...payments.map((p) => ({
      id: `payment-${p.id}`,
      kind: "PAYMENT" as const,
      title: `${p.expense.title}: ${(p.amountCents / 100).toFixed(2)} zł`,
      date: isoDate(p.dueDate!),
      time: null,
      endTime: null,
      done: !!p.paidAt,
      location: null,
      notes: p.note,
      refId: p.id,
    })),
  ];
  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  res.json(items);
});

// ─── Spotkania (własne wpisy) ───────────────────────────────────

async function entryData(weddingId: string, body: unknown) {
  const input = calendarEntrySchema.parse(body);
  if (input.vendorId && !(await prisma.vendor.count({ where: { id: input.vendorId, weddingId } }))) throw badRequest("invalid_reference");
  return {
    ...input,
    startsAt: wallClockToDate(input.startsAt),
    endsAt: input.endsAt ? wallClockToDate(input.endsAt) : null,
  };
}

const serializeEntry = (e: Awaited<ReturnType<typeof prisma.calendarEntry.findFirstOrThrow>>) => ({
  id: e.id,
  title: e.title,
  startsAt: dateToWallClock(e.startsAt),
  endsAt: e.endsAt ? dateToWallClock(e.endsAt) : null,
  location: e.location,
  notes: e.notes,
  vendorId: e.vendorId,
});

calendarRouter.get("/entries/:id", async (req, res) => {
  const e = await prisma.calendarEntry.findFirst({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!e) throw notFound();
  res.json(serializeEntry(e));
});

calendarRouter.post("/entries", requireRole("CO_PLANNER"), async (req, res) => {
  const data = await entryData(req.wedding!.id, req.body);
  res.status(201).json(serializeEntry(await prisma.calendarEntry.create({ data: { ...data, weddingId: req.wedding!.id } })));
});

calendarRouter.put("/entries/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const data = await entryData(req.wedding!.id, req.body);
  const { count } = await prisma.calendarEntry.updateMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id }, data });
  if (!count) throw notFound();
  res.json(serializeEntry(await prisma.calendarEntry.findUniqueOrThrow({ where: { id: param(req, "id") } })));
});

calendarRouter.delete("/entries/:id", requireRole("CO_PLANNER"), async (req, res) => {
  const { count } = await prisma.calendarEntry.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});
