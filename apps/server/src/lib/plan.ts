import type { Wedding } from "@prisma/client";
import { PLANS, type Feature } from "@wedding/shared";
import { prisma } from "./db";
import { paymentRequired } from "./http";

type Limit = keyof (typeof PLANS)["START"]["limits"];

export function assertWithinLimit(wedding: Pick<Wedding, "plan">, limit: Limit, requested: number) {
  const max = PLANS[wedding.plan].limits[limit];
  if (requested > max) throw paymentRequired("plan_limit", { limit, max, plan: wedding.plan });
}

export function assertFeature(wedding: Pick<Wedding, "plan">, feature: Feature) {
  if (!PLANS[wedding.plan].features[feature]) throw paymentRequired("feature_unavailable", { feature, plan: wedding.plan });
}

/**
 * Miejsca gości liczone do limitu: każdy gość z listy + zarezerwowane miejsce na osobę
 * towarzyszącą. Dzięki temu dopisanie osoby towarzyszącej przez gościa nigdy nie przekroczy limitu.
 */
export async function guestSlots(weddingId: string, excludeHouseholdId?: string): Promise<number> {
  const where = { weddingId, isPlusOne: false, ...(excludeHouseholdId ? { householdId: { not: excludeHouseholdId } } : {}) };
  const [guests, plusOnes] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.count({ where: { ...where, plusOneAllowed: true } }),
  ]);
  return guests + plusOnes;
}
