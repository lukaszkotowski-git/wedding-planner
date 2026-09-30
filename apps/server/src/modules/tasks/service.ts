import type { Prisma, Wedding } from "@prisma/client";
import { DEFAULT_BUDGET_CATEGORIES, addDays, isLocale, templatesFor } from "@wedding/shared";
import { prisma } from "../../lib/db";
import { isoDate } from "../../lib/dates";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Dogenerowuje brakujące zadania z szablonu dla typu ceremonii (idempotentne: unikalny templateKey).
 * Istniejących zadań nie zmienia ani nie usuwa, nawet po zmianie typu ceremonii.
 */
export async function generateTemplateTasks(db: Db, wedding: Pick<Wedding, "id" | "date" | "ceremonyType" | "locale">) {
  const lang = isLocale(wedding.locale) ? wedding.locale : "pl";
  const date = isoDate(wedding.date);
  const { count } = await db.task.createMany({
    data: templatesFor(wedding.ceremonyType).map((tpl) => ({
      weddingId: wedding.id,
      templateKey: tpl.key,
      title: tpl.title[lang],
      description: tpl.description?.[lang] ?? null,
      category: tpl.category,
      offsetDays: tpl.offsetDays,
      dueMode: "RELATIVE" as const,
      dueDate: new Date(addDays(date, tpl.offsetDays)),
    })),
    skipDuplicates: true,
  });
  return count;
}

/** Domyślne osoby do przypisania zadań: para młoda. */
export async function ensureDefaultAssignees(db: Db, wedding: Pick<Wedding, "id" | "partnerOneName" | "partnerTwoName">) {
  if (await db.assignee.count({ where: { weddingId: wedding.id } })) return;
  await db.assignee.createMany({
    data: [wedding.partnerOneName, wedding.partnerTwoName].map((name, order) => ({ weddingId: wedding.id, name, order })),
  });
}

export async function createDefaultBudgetCategories(db: Db, wedding: Pick<Wedding, "id" | "locale">) {
  const names = DEFAULT_BUDGET_CATEGORIES[isLocale(wedding.locale) ? wedding.locale : "pl"];
  await db.budgetCategory.createMany({ data: names.map((name, order) => ({ weddingId: wedding.id, name, order })) });
}

/** Po zmianie daty ślubu: terminy liczone względnie przesuwają się razem z nią; ręczne zostają. */
export async function recomputeRelativeDueDates(db: Db, weddingId: string, newDate: string) {
  await db.$executeRaw`
    UPDATE "task" SET "dueDate" = ${newDate}::date + "offsetDays", "updatedAt" = now()
    WHERE "weddingId" = ${weddingId} AND "dueMode" = 'RELATIVE' AND "offsetDays" IS NOT NULL`;
}
