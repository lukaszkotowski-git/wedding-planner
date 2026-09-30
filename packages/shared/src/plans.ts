/**
 * Pakiety: jednorazowa opłata za wesele, ważna do 12 mies. po dacie ślubu.
 * Jedno źródło prawdy dla limitów: używa go serwer (egzekwowanie) i klient (UI, cennik).
 */
export const PLAN_IDS = ["START", "STANDARD", "PREMIUM"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Feature =
  | "groupGifts"
  | "budget"
  | "vendors"
  | "fullExport"
  | "guestImport"
  | "emailReminders"
  | "thankYouList"
  | "seatingPlan"
  | "pdfExport"
  | "passwordProtectedPage"
  | "removeBranding";

export interface PlanDefinition {
  id: PlanId;
  /** Cena w groszach (PLN). */
  pricePln: number;
  limits: {
    guests: number;
    gifts: number;
    /** Członkowie zespołu poza właścicielem. */
    teamMembers: number;
    pageThemes: number;
    /** Miesiące przechowywania danych gości po dacie ślubu. */
    dataRetentionMonths: number;
  };
  features: Record<Feature, boolean>;
}

const NONE: Record<Feature, boolean> = {
  groupGifts: false,
  budget: false,
  vendors: false,
  fullExport: false,
  guestImport: false,
  emailReminders: false,
  thankYouList: false,
  seatingPlan: false,
  pdfExport: false,
  passwordProtectedPage: false,
  removeBranding: false,
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  START: {
    id: "START",
    pricePln: 0,
    limits: { guests: 40, gifts: 10, teamMembers: 1, pageThemes: 1, dataRetentionMonths: 3 },
    features: NONE,
  },
  STANDARD: {
    id: "STANDARD",
    pricePln: 149_00,
    limits: { guests: 200, gifts: Infinity, teamMembers: 3, pageThemes: 3, dataRetentionMonths: 12 },
    features: {
      ...NONE,
      groupGifts: true,
      budget: true,
      vendors: true,
      fullExport: true,
      guestImport: true,
      emailReminders: true,
      thankYouList: true,
      removeBranding: true,
    },
  },
  PREMIUM: {
    id: "PREMIUM",
    pricePln: 249_00,
    limits: {
      guests: 500,
      gifts: Infinity,
      teamMembers: Infinity,
      pageThemes: Infinity,
      dataRetentionMonths: 24,
    },
    features: Object.fromEntries(Object.keys(NONE).map((k) => [k, true])) as Record<Feature, boolean>,
  },
};

export function planHasFeature(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan].features[feature];
}

/** Kwota dopłaty przy zmianie pakietu na wyższy (w groszach). */
export function upgradePrice(from: PlanId, to: PlanId): number {
  return Math.max(0, PLANS[to].pricePln - PLANS[from].pricePln);
}
