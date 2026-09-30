import { describe, expect, it } from "vitest";
import { matchGuests, similarity } from "./matching";
import { childPriceTiersSchema, tierForAge } from "./schemas/event";
import { giftAvailability, giftInputSchema, type ReservationLike } from "./schemas/gifts";
import { guestInputSchema } from "./schemas/guests";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("matchGuests", () => {
  const guests = [
    { id: "1", firstName: "Małgorzata", lastName: "Kowalska" },
    { id: "2", firstName: "Jan", lastName: "Kowalski" },
    { id: "3", firstName: "Jan", lastName: "Nowak" },
    { id: "4", firstName: "Łukasz", lastName: "Wiśniewski" },
  ];

  it("ignores diacritics and case", () => {
    expect(matchGuests({ firstName: "lukasz", lastName: "WISNIEWSKI" }, guests).map((g) => g.id)).toEqual(["4"]);
  });

  it("tolerates typos", () => {
    expect(matchGuests({ firstName: "Malgorzta", lastName: "Kowalska" }, guests)[0]?.id).toBe("1");
  });

  it("requires a similar last name", () => {
    expect(matchGuests({ firstName: "Jan", lastName: "Zieliński" }, guests)).toEqual([]);
  });

  it("ranks the closest match first", () => {
    expect(matchGuests({ firstName: "Jan", lastName: "Kowalski" }, guests)[0]?.id).toBe("2");
  });

  it("similarity is 1 for identical strings", () => {
    expect(similarity("Anna", "anna")).toBe(1);
  });
});

describe("giftAvailability", () => {
  const r = (status: ReservationLike["status"], expiresAt: Date, amountCents: number | null = null) => ({
    status,
    expiresAt,
    amountCents,
  });

  it("single gift is blocked by active pending or confirmed", () => {
    const g = { isGroupGift: false, targetCents: null };
    expect(giftAvailability(g, []).available).toBe(true);
    expect(giftAvailability(g, [r("PENDING", future)]).available).toBe(false);
    expect(giftAvailability(g, [r("PENDING", past)]).available).toBe(true);
    expect(giftAvailability(g, [r("CONFIRMED", past)]).available).toBe(false);
    expect(giftAvailability(g, [r("CANCELLED", future)]).available).toBe(true);
  });

  it("group gift tracks remaining amount", () => {
    const g = { isGroupGift: true, targetCents: 100_00 };
    const a = giftAvailability(g, [r("CONFIRMED", past, 30_00), r("PENDING", future, 20_00), r("PENDING", past, 50_00)]);
    expect(a).toEqual({ available: true, confirmedCents: 30_00, pledgedCents: 50_00, remainingCents: 50_00 });
    expect(giftAvailability(g, [r("CONFIRMED", past, 100_00)]).available).toBe(false);
  });
});

describe("schemas", () => {
  it("converts gift money to cents and requires group target", () => {
    const parsed = giftInputSchema.parse({ title: "Ekspres", price: "1299,99" });
    expect(parsed.priceCents).toBe(129999);
    expect(giftInputSchema.safeParse({ title: "X", isGroupGift: true }).success).toBe(false);
  });

  it("strips child-only fields from adults", () => {
    const g = guestInputSchema.parse({ firstName: "A", type: "ADULT", age: 5, needsHighChair: true });
    expect(g.age).toBeNull();
    expect(g.needsHighChair).toBe(false);
    const c = guestInputSchema.parse({ firstName: "B", type: "CHILD", age: 3, plusOneAllowed: true });
    expect(c.plusOneAllowed).toBe(false);
  });

  it("rejects overlapping child tiers and finds a tier by age", () => {
    const tiers = [
      { fromAge: 0, toAge: 3, pricePercent: 0 },
      { fromAge: 4, toAge: 12, pricePercent: 50 },
    ];
    expect(childPriceTiersSchema.safeParse(tiers).success).toBe(true);
    expect(childPriceTiersSchema.safeParse([...tiers, { fromAge: 10, toAge: 14, pricePercent: 80 }]).success).toBe(false);
    expect(tierForAge(tiers, 7)?.pricePercent).toBe(50);
    expect(tierForAge(tiers, 15)).toBeNull();
  });
});
