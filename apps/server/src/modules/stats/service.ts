import { tierForAge } from "@wedding/shared";
import { prisma } from "../../lib/db";
import { effectiveParts } from "../guests/service";

/** Liczby do pulpitu i arkusza „Podsumowanie”. Wszystko liczone w pamięci: wesele ma max kilkaset osób. */
export async function computeStats(weddingId: string) {
  const [parts, meals, tiers, households, gifts, pendingJoinRequests, tasks] = await Promise.all([
    prisma.eventPart.findMany({ where: { weddingId }, orderBy: [{ order: "asc" }, { startsAt: "asc" }] }),
    prisma.mealOption.findMany({ where: { weddingId }, orderBy: { order: "asc" } }),
    prisma.childPriceTier.findMany({ where: { weddingId }, orderBy: { fromAge: "asc" } }),
    prisma.household.findMany({
      where: { weddingId },
      include: { invitedParts: { select: { id: true } }, guests: { include: { rsvps: true } } },
    }),
    prisma.gift.findMany({ where: { weddingId }, include: { reservations: true } }),
    prisma.joinRequest.count({ where: { weddingId, status: "PENDING" } }),
    prisma.task.findMany({
      where: { weddingId },
      select: { id: true, title: true, dueDate: true, status: true, assignee: { select: { name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
  ]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((t) => t.status !== "DONE");

  const guests = households.flatMap((h) => h.guests.map((g) => ({ ...g, household: h })));
  const attendingAny = (g: (typeof guests)[number]) => g.rsvps.some((r) => r.attending);
  const attending = guests.filter(attendingAny);
  const responded = households.filter((h) => h.respondedAt);

  const now = new Date();
  const giftActive = (r: (typeof gifts)[number]["reservations"][number]) =>
    r.status === "CONFIRMED" || (r.status === "PENDING" && r.expiresAt > now);

  return {
    households: {
      total: households.length,
      responded: responded.length,
      pending: households.length - responded.length,
    },
    guests: {
      invited: guests.filter((g) => !g.isPlusOne).length,
      plusOnes: guests.filter((g) => g.isPlusOne).length,
      attending: attending.length,
      declined: guests.filter((g) => g.household.respondedAt && !attendingAny(g)).length,
      pending: guests.filter((g) => !g.household.respondedAt).length,
      attendingAdults: attending.filter((g) => g.type === "ADULT").length,
      attendingChildren: attending.filter((g) => g.type === "CHILD").length,
    },
    parts: parts.map((p) => {
      const invited = guests.filter((g) => effectiveParts(g.household, parts).some((x) => x.id === p.id));
      return {
        id: p.id,
        name: p.name,
        invited: invited.length,
        attending: guests.filter((g) => g.rsvps.some((r) => r.eventPartId === p.id && r.attending)).length,
      };
    }),
    meals: [
      ...meals.map((m) => ({ id: m.id, name: m.name, count: attending.filter((g) => g.mealOptionId === m.id).length })),
      { id: null, name: null, count: attending.filter((g) => !g.mealOptionId).length },
    ],
    dietNotes: attending.filter((g) => g.dietNotes).length,
    children: {
      highChairs: attending.filter((g) => g.type === "CHILD" && g.needsHighChair).length,
      withoutSeat: attending.filter((g) => g.type === "CHILD" && !g.needsSeparateSeat).length,
      tiers: [
        ...tiers.map((t) => ({
          fromAge: t.fromAge,
          toAge: t.toAge,
          pricePercent: t.pricePercent,
          count: attending.filter((g) => g.type === "CHILD" && tierForAge(tiers, g.age)?.id === t.id).length,
        })),
        {
          fromAge: null,
          toAge: null,
          pricePercent: 100,
          count: attending.filter((g) => g.type === "CHILD" && !tierForAge(tiers, g.age)).length,
        },
      ],
    },
    logistics: {
      accommodation: responded.filter((h) => h.needsAccommodation).length,
      transport: responded.filter((h) => h.needsTransport).length,
    },
    gifts: {
      total: gifts.length,
      reserved: gifts.filter((g) =>
        g.isGroupGift
          ? g.reservations.filter(giftActive).reduce((s, r) => s + (r.amountCents ?? 0), 0) >= (g.targetCents ?? 0)
          : g.reservations.some(giftActive),
      ).length,
    },
    pendingJoinRequests,
    tasks: {
      total: tasks.length,
      done: tasks.length - openTasks.length,
      overdue: openTasks.filter((t) => t.dueDate && t.dueDate.toISOString().slice(0, 10) < todayIso).length,
      next: openTasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        assignee: t.assignee?.name ?? null,
      })),
    },
  };
}
