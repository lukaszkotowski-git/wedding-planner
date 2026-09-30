import { PLANS, hasRole, tierForAge, type WeddingRole } from "@wedding/shared";
import type { Wedding } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/db";
import { t as translate } from "../../lib/i18n";
import { budgetOverview } from "../budget/service";
import { computeStats } from "../stats/service";
import { effectiveParts, householdStatus, householdInclude, rsvpUrl } from "../guests/service";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EEE6" } };

function addSheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ ...c, width: c.width ?? Math.max(12, c.header.length + 2) }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const money = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

/**
 * Pakiet Start: tylko arkusz gości. Pełny eksport: podsumowanie, menu, dzieci, prezenty.
 * Dane rezerwujących prezenty tylko dla ról PARTNER+ (jak w panelu).
 */
export async function buildWorkbook(wedding: Wedding, role: WeddingRole, locale: string) {
  const t = (key: string) => translate(locale, `export.${key}`);
  const yesNo = (v: boolean | null | undefined) => (v == null ? t("values.none") : v ? t("values.yes") : t("values.no"));
  const full = PLANS[wedding.plan].features.fullExport;

  const [parts, meals, tiers, households] = await Promise.all([
    prisma.eventPart.findMany({ where: { weddingId: wedding.id }, orderBy: [{ order: "asc" }, { startsAt: "asc" }] }),
    prisma.mealOption.findMany({ where: { weddingId: wedding.id }, orderBy: { order: "asc" } }),
    prisma.childPriceTier.findMany({ where: { weddingId: wedding.id }, orderBy: { fromAge: "asc" } }),
    prisma.household.findMany({ where: { weddingId: wedding.id }, include: householdInclude, orderBy: { createdAt: "asc" } }),
  ]);
  const mealName = new Map(meals.map((m) => [m.id, m.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Wedding Planner";
  wb.created = new Date();

  // Płaska lista osób: gość, a zaraz po nim jego osoba towarzysząca.
  const people = households.flatMap((h) =>
    h.guests.flatMap((g) => [
      { h, g, plusOneOf: null as string | null },
      ...(g.plusOne ? [{ h, g: { ...g.plusOne, plusOne: null }, plusOneOf: `${g.firstName} ${g.lastName}`.trim() }] : []),
    ]),
  );

  if (full) {
    const stats = await computeStats(wedding.id);
    const ws = addSheet(wb, t("sheets.summary"), [
      { header: t("cols.metric"), key: "metric", width: 36 },
      { header: t("cols.value"), key: "value", width: 14 },
    ]);
    const rows: [string, number][] = [
      ["households", stats.households.total],
      ["responded", stats.households.responded],
      ["invited", stats.guests.invited],
      ["plusOnes", stats.guests.plusOnes],
      ["attending", stats.guests.attending],
      ["declined", stats.guests.declined],
      ["pending", stats.guests.pending],
      ["adults", stats.guests.attendingAdults],
      ["children", stats.guests.attendingChildren],
      ["highChairs", stats.children.highChairs],
      ["accommodation", stats.logistics.accommodation],
      ["transport", stats.logistics.transport],
      ["gifts", stats.gifts.reserved],
    ];
    for (const [key, value] of rows) ws.addRow({ metric: t(`summary.${key}`), value });
    ws.addRow({});
    for (const p of stats.parts) ws.addRow({ metric: `${p.name}: ${t("cols.attending")}`, value: p.attending });
  }

  // ─── Goście ───
  const guestsWs = addSheet(wb, t("sheets.guests"), [
    { header: t("cols.household"), key: "household", width: 24 },
    { header: t("cols.firstName"), key: "firstName" },
    { header: t("cols.lastName"), key: "lastName", width: 16 },
    { header: t("cols.type"), key: "type" },
    { header: t("cols.age"), key: "age", width: 8 },
    { header: t("cols.plusOneOf"), key: "plusOneOf", width: 22 },
    { header: t("cols.side"), key: "side" },
    { header: t("cols.tags"), key: "tags" },
    { header: t("cols.status"), key: "status", width: 16 },
    ...parts.map((p) => ({ header: p.name, key: `part_${p.id}` })),
    { header: t("cols.meal"), key: "meal", width: 18 },
    { header: t("cols.diet"), key: "diet", width: 24 },
    { header: t("cols.accommodation"), key: "accommodation" },
    { header: t("cols.transport"), key: "transport" },
    { header: t("cols.email"), key: "email", width: 24 },
    { header: t("cols.phone"), key: "phone", width: 14 },
    { header: t("cols.message"), key: "message", width: 30 },
    { header: t("cols.rsvpLink"), key: "rsvpLink", width: 50 },
  ]);
  for (const { h, g, plusOneOf } of people) {
    const invited = new Set(effectiveParts(h, parts).map((p) => p.id));
    const answer = new Map(g.rsvps.map((r) => [r.eventPartId, r.attending]));
    guestsWs.addRow({
      household: h.name,
      firstName: g.firstName,
      lastName: g.lastName,
      type: t(`values.${g.type}`),
      age: g.age,
      plusOneOf,
      side: t(`values.${h.side}`),
      tags: h.tags.join(", "),
      status: t(`values.${householdStatus(h)}`),
      ...Object.fromEntries(
        parts.map((p) => [`part_${p.id}`, invited.has(p.id) ? yesNo(answer.get(p.id)) : t("values.none")]),
      ),
      meal: g.mealOptionId ? mealName.get(g.mealOptionId) : null,
      diet: g.dietNotes,
      accommodation: h.respondedAt ? yesNo(h.needsAccommodation) : null,
      transport: h.respondedAt ? yesNo(h.needsTransport) : null,
      email: h.email,
      phone: h.phone,
      message: h.messageToCouple,
      rsvpLink: rsvpUrl(wedding.slug, h.token),
    });
  }

  if (!full) return wb;

  const attending = people.filter(({ g }) => g.rsvps.some((r) => r.attending));

  // ─── Menu dla sali ───
  const menuWs = addSheet(wb, t("sheets.menu"), [
    { header: t("cols.meal"), key: "meal", width: 28 },
    { header: t("cols.count"), key: "count", width: 10 },
  ]);
  for (const m of meals) menuWs.addRow({ meal: m.name, count: attending.filter(({ g }) => g.mealOptionId === m.id).length });
  const noMeal = attending.filter(({ g }) => !g.mealOptionId).length;
  if (noMeal) menuWs.addRow({ meal: t("values.noMeal"), count: noMeal });
  menuWs.addRow({});
  const dietHeader = menuWs.addRow({ meal: t("cols.diet") });
  dietHeader.font = { bold: true };
  for (const { h, g } of attending.filter(({ g }) => g.dietNotes)) {
    menuWs.addRow({ meal: `${g.firstName} ${g.lastName} (${h.name})`, count: g.dietNotes });
  }

  // ─── Dzieci ───
  const kidsWs = addSheet(wb, t("sheets.children"), [
    { header: t("cols.firstName"), key: "firstName" },
    { header: t("cols.lastName"), key: "lastName", width: 16 },
    { header: t("cols.household"), key: "household", width: 24 },
    { header: t("cols.age"), key: "age", width: 8 },
    { header: t("cols.tier"), key: "tier", width: 22 },
    { header: t("cols.meal"), key: "meal", width: 18 },
    { header: t("cols.highChair"), key: "highChair" },
    { header: t("cols.separateSeat"), key: "separateSeat" },
    { header: t("cols.attending"), key: "attending" },
  ]);
  for (const { h, g } of people.filter(({ g }) => g.type === "CHILD")) {
    const tier = tierForAge(tiers, g.age);
    kidsWs.addRow({
      firstName: g.firstName,
      lastName: g.lastName,
      household: h.name,
      age: g.age,
      tier: tier ? `${tier.fromAge}–${tier.toAge}: ${tier.pricePercent}%` : t("values.noTier"),
      meal: g.mealOptionId ? mealName.get(g.mealOptionId) : null,
      highChair: yesNo(g.needsHighChair),
      separateSeat: yesNo(g.needsSeparateSeat),
      attending: h.respondedAt ? yesNo(g.rsvps.some((r) => r.attending)) : t("values.PENDING"),
    });
  }

  // ─── Prezenty ───
  const withReservers = hasRole(role, "PARTNER");
  const gifts = await prisma.gift.findMany({
    where: { weddingId: wedding.id },
    include: { reservations: { where: { status: { not: "CANCELLED" } } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const now = new Date();
  const giftsWs = addSheet(wb, t("sheets.gifts"), [
    { header: t("cols.gift"), key: "gift", width: 30 },
    { header: t("cols.price"), key: "price", width: 10 },
    { header: t("cols.group"), key: "group" },
    { header: t("cols.target"), key: "target", width: 10 },
    { header: t("cols.pledged"), key: "pledged", width: 14 },
    { header: t("cols.status"), key: "status", width: 22 },
    ...(withReservers
      ? [
          { header: t("cols.reservedBy"), key: "reservedBy", width: 24 },
          { header: t("cols.email"), key: "email", width: 26 },
          { header: t("cols.amount"), key: "amount", width: 10 },
        ]
      : []),
    { header: t("cols.url"), key: "url", width: 40 },
  ]);
  for (const g of gifts) {
    const active = g.reservations.filter((r) => r.status === "CONFIRMED" || r.expiresAt > now);
    const pledged = active.reduce((s, r) => s + (r.amountCents ?? 0), 0);
    const base = {
      gift: g.title,
      price: money(g.priceCents),
      group: yesNo(g.isGroupGift),
      target: money(g.targetCents),
      pledged: g.isGroupGift ? money(pledged) : null,
      url: g.url,
    };
    if (active.length === 0) {
      giftsWs.addRow({ ...base, status: t("values.available") });
      continue;
    }
    for (const [i, r] of active.entries()) {
      giftsWs.addRow({
        ...(i === 0 ? base : {}),
        status: r.status === "CONFIRMED" ? t("values.reserved") : t("values.pendingEmail"),
        ...(withReservers ? { reservedBy: r.name, email: r.email, amount: money(r.amountCents) } : {}),
      });
    }
  }
  const moneyKeys = new Set(["price", "target", "pledged", "amount"]);
  giftsWs.columns.forEach((col) => {
    if (col.key && moneyKeys.has(col.key)) col.numFmt = "#,##0.00";
  });

  // ─── Zadania ───
  const tasks = await prisma.task.findMany({
    where: { weddingId: wedding.id },
    include: { assignee: true },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  const tasksWs = addSheet(wb, t("sheets.tasks"), [
    { header: t("cols.task"), key: "title", width: 50 },
    { header: t("cols.category"), key: "category", width: 16 },
    { header: t("cols.dueDate"), key: "dueDate", width: 12 },
    { header: t("cols.assignee"), key: "assignee", width: 18 },
    { header: t("cols.status"), key: "status", width: 14 },
  ]);
  for (const task of tasks) {
    tasksWs.addRow({
      title: task.title,
      category: translate(locale, `tasks.categories.${task.category}`),
      dueDate: task.dueDate,
      assignee: task.assignee?.name,
      status: t(`values.${task.status}`),
    });
  }
  tasksWs.getColumn("dueDate").numFmt = "yyyy-mm-dd";

  // ─── Usługodawcy ───
  if (PLANS[wedding.plan].features.vendors) {
    const vendors = await prisma.vendor.findMany({ where: { weddingId: wedding.id }, orderBy: [{ category: "asc" }, { name: "asc" }] });
    const vendorsWs = addSheet(wb, t("sheets.vendors"), [
      { header: t("cols.category"), key: "category", width: 18 },
      { header: t("cols.vendor"), key: "name", width: 28 },
      { header: t("cols.status"), key: "status", width: 14 },
      { header: t("cols.contact"), key: "contact", width: 20 },
      { header: t("cols.phone"), key: "phone", width: 14 },
      { header: t("cols.email"), key: "email", width: 26 },
      { header: t("cols.website"), key: "website", width: 30 },
      { header: t("cols.notes"), key: "notes", width: 40 },
    ]);
    for (const v of vendors) {
      vendorsWs.addRow({
        category: translate(locale, `vendors.categories.${v.category}`),
        name: v.name,
        status: t(`values.${v.status}`),
        contact: v.contactPerson,
        phone: v.phone,
        email: v.email,
        website: v.website,
        notes: v.notes,
      });
    }
  }

  // ─── Budżet (jak w panelu: tylko para) ───
  if (PLANS[wedding.plan].features.budget && hasRole(role, "PARTNER")) {
    const b = await budgetOverview(wedding.id, wedding.platePriceCents);
    const budgetWs = addSheet(wb, t("sheets.budget"), [
      { header: t("cols.category"), key: "category", width: 26 },
      { header: t("cols.item"), key: "item", width: 32 },
      { header: t("cols.planned"), key: "planned", width: 12 },
      { header: t("cols.committed"), key: "committed", width: 12 },
      { header: t("cols.paid"), key: "paid", width: 12 },
      { header: t("cols.toPay"), key: "toPay", width: 12 },
      { header: t("cols.dueDate"), key: "dueDate", width: 12 },
      { header: t("cols.paidAt"), key: "paidAt", width: 14 },
    ]);
    for (const c of b.categories) {
      const row = budgetWs.addRow({
        category: c.name,
        planned: money(c.plannedCents),
        committed: money(c.committedCents),
        paid: money(c.paidCents),
        toPay: money(c.committedCents - c.paidCents),
      });
      row.font = { bold: true };
      for (const e of c.expenses) {
        budgetWs.addRow({ item: e.title, committed: money(e.amountCents), paid: money(e.paidCents), toPay: money(e.amountCents - e.paidCents) });
        for (const p of e.payments) {
          budgetWs.addRow({
            item: `  ${t("values.installment")}${p.note ? `: ${p.note}` : ""}`,
            committed: money(p.amountCents),
            dueDate: p.dueDate,
            paidAt: p.paidAt,
          });
        }
      }
    }
    const total = budgetWs.addRow({
      category: t("values.total"),
      planned: money(b.totals.plannedCents),
      committed: money(b.totals.committedCents),
      paid: money(b.totals.paidCents),
      toPay: money(b.totals.committedCents - b.totals.paidCents),
    });
    total.font = { bold: true };
    for (const key of ["planned", "committed", "paid", "toPay"]) budgetWs.getColumn(key).numFmt = "#,##0.00";
  }

  return wb;
}
