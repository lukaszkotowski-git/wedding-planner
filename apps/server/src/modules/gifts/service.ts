import type { Gift, GiftReservation } from "@prisma/client";
import { giftAvailability } from "@wedding/shared";
import { mediaUrl } from "../../lib/storage";

export function publicGift(g: Gift & { reservations: GiftReservation[] }, now = new Date()) {
  const a = giftAvailability(g, g.reservations, now);
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    url: g.url,
    imageUrl: mediaUrl(g.imageKey),
    priceCents: g.priceCents,
    isGroupGift: g.isGroupGift,
    targetCents: g.targetCents,
    available: a.available,
    pledgedCents: g.isGroupGift ? a.pledgedCents : null,
    remainingCents: a.remainingCents,
  };
}

/** Widok pary: z danymi rezerwujących (kto, e-mail, kwota). */
export function adminGift(g: Gift & { reservations: GiftReservation[] }, withReservers: boolean) {
  const now = new Date();
  return {
    ...publicGift(g, now),
    hidden: g.hidden,
    order: g.order,
    reservations: g.reservations
      .filter((r) => r.status === "CONFIRMED" || (r.status === "PENDING" && r.expiresAt > now))
      .map((r) => ({
        id: r.id,
        status: r.status,
        amountCents: r.amountCents,
        confirmedAt: r.confirmedAt,
        ...(withReservers ? { name: r.name, email: r.email } : {}),
      })),
  };
}
