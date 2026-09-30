import { describe, expect, it } from "vitest";
import { hasRole } from "./roles";
import { PLANS, planHasFeature, upgradePrice } from "./plans";
import { suggestSlug } from "./schemas/wedding";

describe("plans", () => {
  it("higher plans never have lower limits", () => {
    const order = [PLANS.START, PLANS.STANDARD, PLANS.PREMIUM];
    for (let i = 1; i < order.length; i++) {
      for (const key of Object.keys(order[i]!.limits) as (keyof typeof PLANS.START.limits)[]) {
        expect(order[i]!.limits[key]).toBeGreaterThanOrEqual(order[i - 1]!.limits[key]);
      }
    }
  });

  it("premium has every feature", () => {
    for (const f of Object.keys(PLANS.START.features) as (keyof typeof PLANS.START.features)[]) {
      expect(planHasFeature("PREMIUM", f)).toBe(true);
    }
  });

  it("upgrade charges the difference", () => {
    expect(upgradePrice("STANDARD", "PREMIUM")).toBe(100_00);
    expect(upgradePrice("PREMIUM", "START")).toBe(0);
  });
});

describe("roles", () => {
  it("ranks roles", () => {
    expect(hasRole("OWNER", "PARTNER")).toBe(true);
    expect(hasRole("VIEWER", "CO_PLANNER")).toBe(false);
  });
});

describe("suggestSlug", () => {
  it("strips polish diacritics", () => {
    expect(suggestSlug("Łucja", "Paweł")).toBe("lucja-i-pawel");
    expect(suggestSlug("Zoë Anne", "Jérôme", "and")).toBe("zoe-anne-and-jerome");
  });
});
