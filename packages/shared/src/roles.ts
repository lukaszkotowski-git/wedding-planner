export const WEDDING_ROLES = ["OWNER", "PARTNER", "CO_PLANNER", "VIEWER"] as const;
export type WeddingRole = (typeof WEDDING_ROLES)[number];

const RANK: Record<WeddingRole, number> = {
  VIEWER: 0,
  CO_PLANNER: 1,
  PARTNER: 2,
  OWNER: 3,
};

/** Czy rola `actual` ma co najmniej uprawnienia roli `required`. */
export function hasRole(actual: WeddingRole, required: WeddingRole): boolean {
  return RANK[actual] >= RANK[required];
}
