import { cateringEstimate } from "@wedding/shared";
import { prisma } from "../../lib/db";
import { isoDate } from "../../lib/dates";

export async function budgetOverview(weddingId: string, platePriceCents: number | null) {
  const [categories, tiers, guests] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { weddingId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        expenses: {
          orderBy: { createdAt: "asc" },
          include: { payments: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] }, vendor: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.childPriceTier.findMany({ where: { weddingId } }),
    prisma.guest.findMany({
      where: { weddingId },
      select: { type: true, age: true, isPlusOne: true, plusOneAllowed: true, rsvps: { select: { attending: true } }, household: { select: { respondedAt: true } } },
    }),
  ]);

  const today = isoDate(new Date());
  const paid = (p: { paidAt: Date | null; amountCents: number }) => (p.paidAt ? p.amountCents : 0);

  const cats = categories.map((c) => {
    const expenses = c.expenses.map((e) => {
      const paidCents = e.payments.reduce((s, p) => s + paid(p), 0);
      return {
        id: e.id,
        title: e.title,
        amountCents: e.amountCents,
        notes: e.notes,
        vendor: e.vendor,
        paidCents,
        payments: e.payments.map((p) => ({
          id: p.id,
          amountCents: p.amountCents,
          dueDate: p.dueDate ? isoDate(p.dueDate) : null,
          paidAt: p.paidAt ? isoDate(p.paidAt) : null,
          note: p.note,
          overdue: !p.paidAt && !!p.dueDate && isoDate(p.dueDate) < today,
        })),
      };
    });
    return {
      id: c.id,
      name: c.name,
      order: c.order,
      plannedCents: c.plannedCents,
      committedCents: expenses.reduce((s, e) => s + e.amountCents, 0),
      paidCents: expenses.reduce((s, e) => s + e.paidCents, 0),
      expenses,
    };
  });

  // Szacunek cateringu: „potwierdzeni” = będą na którejkolwiek części; „maksymalnie” = wszyscy nieodmówieni + miejsca na +1.
  const attending = guests.filter((g) => g.rsvps.some((r) => r.attending));
  const notDeclined = guests.filter((g) => !g.household.respondedAt || g.rsvps.some((r) => r.attending));
  const openPlusOnes = notDeclined.filter((g) => !g.isPlusOne && g.plusOneAllowed && !g.household.respondedAt).length;
  const estimate = (list: typeof guests, extraAdults = 0) =>
    platePriceCents == null
      ? null
      : cateringEstimate({
          platePriceCents,
          adults: list.filter((g) => g.type === "ADULT").length + extraAdults,
          childAges: list.filter((g) => g.type === "CHILD").map((g) => g.age),
          tiers,
        });

  const upcoming = cats
    .flatMap((c) => c.expenses.flatMap((e) => e.payments.filter((p) => !p.paidAt).map((p) => ({ ...p, expenseTitle: e.title, categoryName: c.name }))))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return {
    totals: {
      plannedCents: cats.reduce((s, c) => s + c.plannedCents, 0),
      committedCents: cats.reduce((s, c) => s + c.committedCents, 0),
      paidCents: cats.reduce((s, c) => s + c.paidCents, 0),
    },
    catering: {
      platePriceCents,
      confirmedCents: estimate(attending),
      maxCents: estimate(notDeclined, openPlusOnes),
    },
    categories: cats,
    upcomingPayments: upcoming,
  };
}
