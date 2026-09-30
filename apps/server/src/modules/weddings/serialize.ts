import type { Wedding } from "@prisma/client";
import { isoDate } from "../../lib/dates";

export function serializeWedding(w: Wedding) {
  return {
    id: w.id,
    slug: w.slug,
    partnerOneName: w.partnerOneName,
    partnerTwoName: w.partnerTwoName,
    date: isoDate(w.date),
    ceremonyType: w.ceremonyType,
    locale: w.locale,
    plan: w.plan,
    rsvpMode: w.rsvpMode,
    rsvpDeadline: w.rsvpDeadline ? isoDate(w.rsvpDeadline) : null,
    welcomeMessage: w.welcomeMessage,
    giftsIntro: w.giftsIntro,
    cashGiftInfo: w.cashGiftInfo,
  };
}

export const coupleName = (w: Pick<Wedding, "partnerOneName" | "partnerTwoName">) =>
  `${w.partnerOneName} & ${w.partnerTwoName}`;
