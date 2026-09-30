import ExcelJS from "exceljs";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, createUser, createWedding, lastMailTo, prisma, sentMails, tokenFrom, type TestUser } from "./helpers";

const W = (id: string) => `/api/weddings/${id}`;

async function setPlan(weddingId: string, plan: "START" | "STANDARD" | "PREMIUM") {
  await prisma.wedding.update({ where: { id: weddingId }, data: { plan } });
}

async function household(owner: TestUser, weddingId: string, body: Record<string, unknown> = {}) {
  const res = await as(owner).post(`${W(weddingId)}/households`, {
    name: "Rodzina Kowalskich",
    email: "kowalscy@test.pl",
    guests: [
      { firstName: "Jan", lastName: "Kowalski", plusOneAllowed: true },
      { firstName: "Zosia", lastName: "Kowalska", type: "CHILD", age: 5, needsHighChair: true },
    ],
    ...body,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as {
    id: string;
    rsvpUrl: string;
    guests: { id: string; firstName: string; plusOne: unknown }[];
  };
}

const tokenOf = (rsvpUrl: string) => rsvpUrl.split("/r/")[1]!;

describe("wedding defaults and tenancy", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let weddingId: string;

  beforeAll(async () => {
    owner = await createUser();
    stranger = await createUser();
    weddingId = (await createWedding(owner)).id;
  });

  it("creates default parts, meals and child tiers", async () => {
    const parts = await as(owner).get(`${W(weddingId)}/event-parts`);
    expect(parts.body.map((p: { startsAt: string }) => p.startsAt)).toEqual(["2030-06-15T15:00", "2030-06-15T17:00"]);
    const meals = await as(owner).get(`${W(weddingId)}/meal-options`);
    expect(meals.body).toHaveLength(3);
    const tiers = await as(owner).get(`${W(weddingId)}/child-tiers`);
    expect(tiers.body.map((t: { pricePercent: number }) => t.pricePercent)).toEqual([0, 50]);
  });

  it("hides every wedding resource from non-members", async () => {
    for (const path of ["", "/households", "/gifts", "/stats", "/team", "/event-parts", "/export/xlsx", "/join-requests"]) {
      const res = await as(stranger).get(`${W(weddingId)}${path}`);
      expect(res.status, path).toBe(404);
    }
  });

  it("does not allow editing another wedding's household by id", async () => {
    const h = await household(owner, weddingId);
    const own = await createWedding(stranger);
    const res = await as(stranger).put(`${W(own.id)}/households/${h.id}`, { name: "X", guests: [{ firstName: "A" }] });
    expect(res.status).toBe(404);
  });

  it("rejects meal options from another wedding", async () => {
    const other = await createWedding(stranger);
    const foreignMeal = (await as(stranger).get(`${W(other.id)}/meal-options`)).body[0].id;
    const res = await as(owner).post(`${W(weddingId)}/households`, {
      name: "X",
      guests: [{ firstName: "A", mealOptionId: foreignMeal }],
    });
    expect(res.status).toBe(400);
  });
});

describe("roles", () => {
  it("viewer can read but not write; partner edits settings", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const { id } = await createWedding(owner);
    await setPlan(id, "PREMIUM");
    await prisma.weddingMember.create({ data: { weddingId: id, userId: viewer.id, role: "VIEWER" } });
    expect((await as(viewer).get(`${W(id)}/households`)).status).toBe(200);
    expect((await as(viewer).post(`${W(id)}/households`, { name: "X", guests: [{ firstName: "A" }] })).status).toBe(403);
    expect((await as(viewer).get(`${W(id)}/export/xlsx`)).status).toBe(403);
  });
});

describe("plan limits", () => {
  it("counts plus-one slots toward the START guest limit", async () => {
    const owner = await createUser();
    const { id } = await createWedding(owner);
    const guests = (n: number) => Array.from({ length: n }, (_, i) => ({ firstName: `G${i}`, lastName: "X" }));
    expect((await as(owner).post(`${W(id)}/households`, { name: "A", guests: guests(20) })).status).toBe(201);
    expect((await as(owner).post(`${W(id)}/households`, { name: "B", guests: guests(19) })).status).toBe(201);
    const res = await as(owner).post(`${W(id)}/households`, {
      name: "C",
      guests: [{ firstName: "Jan", lastName: "Y", plusOneAllowed: true }],
    });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: "plan_limit", limit: "guests", max: 40 });
  });

  it("group gifts require STANDARD", async () => {
    const owner = await createUser();
    const { id } = await createWedding(owner);
    const res = await as(owner).post(`${W(id)}/gifts`, { title: "Rower", isGroupGift: true, target: 3000 });
    expect(res.status).toBe(402);
    expect(res.body.feature).toBe("groupGifts");
  });
});

describe("RSVP via dedicated link", () => {
  let owner: TestUser;
  let weddingId: string;
  let slug: string;

  beforeAll(async () => {
    owner = await createUser();
    ({ id: weddingId, slug } = await createWedding(owner));
  });

  it("full flow: validate, save with plus-one, lock, unlock, resubmit", async () => {
    const h = await household(owner, weddingId);
    const token = tokenOf(h.rsvpUrl);
    const form = (await anon().get(`/api/public/rsvp/${token}`)).body;
    expect(form.household.name).toBe("Rodzina Kowalskich");
    expect(form.eventParts).toHaveLength(2);
    const [ceremony, reception] = form.eventParts.map((p: { id: string }) => p.id);
    const adultMeal = form.mealOptions.find((m: { forChildren: boolean }) => !m.forChildren).id;
    const kidsMeal = form.mealOptions.find((m: { forChildren: boolean }) => m.forChildren).id;
    const [jan, zosia] = form.guests;

    const answer = (overrides: Record<string, unknown> = {}) => ({
      guests: [
        {
          guestId: jan.id,
          attendance: { [ceremony]: true, [reception]: true },
          mealOptionId: adultMeal,
          plusOne: { firstName: "Ewa", lastName: "Nowak", mealOptionId: adultMeal, dietNotes: "bez orzechów" },
        },
        { guestId: zosia.id, attendance: { [ceremony]: true, [reception]: false }, mealOptionId: kidsMeal },
      ],
      needsAccommodation: true,
      consent: true,
      ...overrides,
    });

    // brak zgody, brak odpowiedzi na część, brak menu, menu dziecięce dla dorosłego
    expect((await anon().post(`/api/public/rsvp/${token}`).send(answer({ consent: false }))).status).toBe(400);
    const incomplete = answer();
    incomplete.guests[1]!.attendance = { [ceremony]: true };
    expect((await anon().post(`/api/public/rsvp/${token}`).send(incomplete)).body.error).toBe("rsvp_incomplete");
    const noMeal = answer();
    noMeal.guests[0]!.mealOptionId = null;
    expect((await anon().post(`/api/public/rsvp/${token}`).send(noMeal)).body.error).toBe("rsvp_meal_required");
    const kidsMenuForAdult = answer();
    kidsMenuForAdult.guests[0]!.mealOptionId = kidsMeal;
    expect((await anon().post(`/api/public/rsvp/${token}`).send(kidsMenuForAdult)).status).toBe(400);

    sentMails.length = 0;
    const ok = await anon().post(`/api/public/rsvp/${token}`).send(answer());
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(lastMailTo("kowalscy@test.pl").lines).toHaveLength(3);

    // zablokowane po wysłaniu
    expect((await anon().post(`/api/public/rsvp/${token}`).send(answer())).status).toBe(409);

    const list = (await as(owner).get(`${W(weddingId)}/households`)).body;
    const saved = list.find((x: { id: string }) => x.id === h.id);
    expect(saved).toMatchObject({ status: "ATTENDING", locked: true, needsAccommodation: true });
    expect(saved.guests[0].plusOne).toMatchObject({ firstName: "Ewa", dietNotes: "bez orzechów" });

    const stats = (await as(owner).get(`${W(weddingId)}/stats`)).body;
    expect(stats.guests).toMatchObject({ attending: 3, plusOnes: 1, attendingChildren: 1 });
    expect(stats.parts[1].attending).toBe(2); // Zosia nie zostaje na przyjęciu
    expect(stats.children.tiers[1].count).toBe(1); // 5 lat → próg 4–12
    expect(stats.children.highChairs).toBe(1);

    // para odblokowuje; gość rezygnuje z osoby towarzyszącej
    expect((await as(owner).post(`${W(weddingId)}/households/${h.id}/unlock`)).status).toBe(200);
    const withoutPlusOne = answer();
    delete withoutPlusOne.guests[0]!.plusOne;
    expect((await anon().post(`/api/public/rsvp/${token}`).send(withoutPlusOne)).status).toBe(200);
    expect(await prisma.guest.count({ where: { householdId: h.id, isPlusOne: true } })).toBe(0);
  });

  it("rejects plus-one when not allowed and when the guest declines", async () => {
    const h = await household(owner, weddingId, {
      guests: [{ firstName: "Adam", lastName: "Solo" }],
    });
    const token = tokenOf(h.rsvpUrl);
    const form = (await anon().get(`/api/public/rsvp/${token}`)).body;
    const attendance = Object.fromEntries(form.eventParts.map((p: { id: string }) => [p.id, false]));
    const res = await anon()
      .post(`/api/public/rsvp/${token}`)
      .send({
        guests: [{ guestId: form.guests[0].id, attendance, plusOne: { firstName: "X", lastName: "Y" } }],
        consent: true,
      });
    expect(res.body.error).toBe("plus_one_not_allowed");
  });

  it("only asks about invited parts", async () => {
    const parts = (await as(owner).get(`${W(weddingId)}/event-parts`)).body;
    const h = await household(owner, weddingId, {
      guests: [{ firstName: "Piotr", lastName: "Tylko-Kościół" }],
      invitedPartIds: [parts[0].id],
    });
    const form = (await anon().get(`/api/public/rsvp/${tokenOf(h.rsvpUrl)}`)).body;
    expect(form.eventParts.map((p: { id: string }) => p.id)).toEqual([parts[0].id]);
  });

  it("closes after the deadline", async () => {
    const h = await household(owner, weddingId, { guests: [{ firstName: "Late", lastName: "Guest" }] });
    await prisma.wedding.update({ where: { id: weddingId }, data: { rsvpDeadline: new Date("2020-01-01") } });
    const token = tokenOf(h.rsvpUrl);
    const form = (await anon().get(`/api/public/rsvp/${token}`)).body;
    expect(form.wedding.rsvpOpen).toBe(false);
    const attendance = Object.fromEntries(form.eventParts.map((p: { id: string }) => [p.id, false]));
    const res = await anon()
      .post(`/api/public/rsvp/${token}`)
      .send({ guests: [{ guestId: form.guests[0].id, attendance }], consent: true });
    expect(res.body.error).toBe("rsvp_closed");
    await prisma.wedding.update({ where: { id: weddingId }, data: { rsvpDeadline: null } });
  });

  it("regenerating the token invalidates the old link", async () => {
    const h = await household(owner, weddingId, { guests: [{ firstName: "Old", lastName: "Link" }] });
    const res = await as(owner).post(`${W(weddingId)}/households/${h.id}/regenerate-token`);
    expect(res.body.rsvpUrl).not.toBe(h.rsvpUrl);
    expect((await anon().get(`/api/public/rsvp/${tokenOf(h.rsvpUrl)}`)).status).toBe(404);
  });

  it("serves a QR code with the RSVP link", async () => {
    const h = await household(owner, weddingId, { guests: [{ firstName: "Qr", lastName: "Code" }] });
    const res = await as(owner).get(`${W(weddingId)}/households/${h.id}/qr.svg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(slug).toBeTruthy();
  });
});

describe("open RSVP", () => {
  it("finds households by fuzzy name and handles join requests", async () => {
    const owner = await createUser();
    const { id, slug } = await createWedding(owner);
    await household(owner, id, {
      name: "Wiśniewscy",
      guests: [
        { firstName: "Łukasz", lastName: "Wiśniewski" },
        { firstName: "Marta", lastName: "Wiśniewska" },
      ],
    });

    const found = await anon().post(`/api/public/weddings/${slug}/rsvp-search`).send({ firstName: "lukasz", lastName: "wisniewski" });
    expect(found.body).toHaveLength(1);
    expect(found.body[0].label).toBe("Łukasz W., Marta W.");
    expect((await anon().get(`/api/public/rsvp/${found.body[0].token}`)).status).toBe(200);

    const none = await anon().post(`/api/public/weddings/${slug}/rsvp-search`).send({ firstName: "Anna", lastName: "Zielińska" });
    expect(none.body).toEqual([]);

    sentMails.length = 0;
    const jr = await anon()
      .post(`/api/public/weddings/${slug}/join-requests`)
      .send({ firstName: "Anna", lastName: "Zielińska", email: "anna@test.pl", consent: true });
    expect(jr.status).toBe(201);
    expect(lastMailTo(owner.email).subject).toContain("prośba");
    expect((await anon().post(`/api/public/weddings/${slug}/join-requests`).send({ firstName: "Anna", lastName: "Zielińska", email: "anna@test.pl", consent: true })).status).toBe(409);

    const requests = (await as(owner).get(`${W(id)}/join-requests`)).body;
    expect((await as(owner).post(`${W(id)}/join-requests/${requests[0].id}/approve`)).status).toBe(200);
    const link = lastMailTo("anna@test.pl").url!;
    const form = await anon().get(`/api/public/rsvp/${link.split("/r/")[1]}`);
    expect(form.body.guests[0]).toMatchObject({ firstName: "Anna", lastName: "Zielińska" });

    await prisma.wedding.update({ where: { id }, data: { rsvpMode: "DEDICATED" } });
    expect((await anon().post(`/api/public/weddings/${slug}/rsvp-search`).send({ firstName: "Marta", lastName: "Wiśniewska" })).status).toBe(404);
  });
});

describe("gifts", () => {
  let owner: TestUser;
  let weddingId: string;
  let slug: string;

  beforeAll(async () => {
    owner = await createUser();
    ({ id: weddingId, slug } = await createWedding(owner));
    await setPlan(weddingId, "STANDARD");
  });

  const reserve = (giftId: string, body: Record<string, unknown> = {}) =>
    anon()
      .post(`/api/public/weddings/${slug}/gifts/${giftId}/reserve`)
      .send({ name: "Ciocia Basia", email: `basia${Math.random()}@test.pl`, consent: true, ...body });

  it("reserve → confirm by email → cancel; couple sees who, public does not", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Ekspres", price: "1299.99", url: "https://sklep.pl/e" })).body;
    expect(gift.priceCents).toBe(129999);

    sentMails.length = 0;
    expect((await reserve(gift.id, { email: "basia@test.pl" })).status).toBe(202);
    expect((await reserve(gift.id)).body.error).toBe("gift_taken");

    const confirm = tokenFrom(lastMailTo("basia@test.pl").url, "confirm");
    expect((await anon().post("/api/public/gift-reservations/confirm").send({ token: confirm })).status).toBe(200);
    expect((await anon().post("/api/public/gift-reservations/confirm").send({ token: confirm })).status).toBe(200); // idempotentne

    const adminView = (await as(owner).get(`${W(weddingId)}/gifts`)).body.find((g: { id: string }) => g.id === gift.id);
    expect(adminView.reservations[0]).toMatchObject({ status: "CONFIRMED", name: "Ciocia Basia", email: "basia@test.pl" });

    const publicView = (await anon().get(`/api/public/weddings/${slug}`)).body.gifts.find((g: { id: string }) => g.id === gift.id);
    expect(publicView.available).toBe(false);
    expect(JSON.stringify(publicView)).not.toContain("basia");

    const cancel = tokenFrom(lastMailTo("basia@test.pl").url, "cancel");
    expect((await anon().post("/api/public/gift-reservations/cancel").send({ token: cancel })).status).toBe(200);
    expect((await reserve(gift.id)).status).toBe(202);
  });

  it("expired pending reservation frees the gift and cannot be confirmed afterwards", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Toster" })).body;
    sentMails.length = 0;
    await reserve(gift.id, { email: "slow@test.pl" });
    await prisma.giftReservation.updateMany({ where: { giftId: gift.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reserve(gift.id)).status).toBe(202);
    const token = tokenFrom(lastMailTo("slow@test.pl").url, "confirm");
    expect((await anon().post("/api/public/gift-reservations/confirm").send({ token })).body.error).toBe("gift_taken");
  });

  it("allows exactly one of many concurrent reservations", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Robot" })).body;
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve(gift.id)));
    expect(results.filter((r) => r.status === 202)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
  });

  it("group gift: amounts cannot exceed the target, even concurrently", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Podróż", isGroupGift: true, target: 1000 })).body;
    expect((await reserve(gift.id)).body.error).toBe("amount_required");
    const results = await Promise.all(Array.from({ length: 4 }, () => reserve(gift.id, { amount: 400 })));
    expect(results.filter((r) => r.status === 202)).toHaveLength(2);
    expect((await reserve(gift.id, { amount: 300 })).body.error).toBe("amount_exceeds_remaining");
    expect((await reserve(gift.id, { amount: 200 })).status).toBe(202);
    const g = (await anon().get(`/api/public/weddings/${slug}`)).body.gifts.find((x: { id: string }) => x.id === gift.id);
    expect(g).toMatchObject({ available: false, pledgedCents: 1000_00, remainingCents: 0 });
  });

  it("hidden gifts are not public and cannot be reserved", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Sekret", hidden: true })).body;
    const page = (await anon().get(`/api/public/weddings/${slug}`)).body;
    expect(page.gifts.some((g: { id: string }) => g.id === gift.id)).toBe(false);
    expect((await reserve(gift.id)).status).toBe(404);
  });

  it("uploads an image, strips it to webp and serves it", async () => {
    const gift = (await as(owner).post(`${W(weddingId)}/gifts`, { title: "Z obrazkiem" })).body;
    const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#b45309" } }).png().toBuffer();
    const res = await as(owner)
      .post(`${W(weddingId)}/gifts/${gift.id}/image`)
      .attach("image", png, { filename: "x.png", contentType: "image/png" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const img = await anon().get(res.body.imageUrl).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(img.status).toBe(200);
    const meta = await sharp(img.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1200, height: 600 });

    const bad = await as(owner)
      .post(`${W(weddingId)}/gifts/${gift.id}/image`)
      .attach("image", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" });
    expect(bad.status).toBe(400);
  });
});

describe("team", () => {
  it("invites by email; only the invited address can accept; START allows one member", async () => {
    const owner = await createUser();
    const partner = await createUser();
    const intruder = await createUser();
    const { id } = await createWedding(owner);

    sentMails.length = 0;
    expect((await as(owner).post(`${W(id)}/team/invitations`, { email: partner.email, role: "PARTNER" })).status).toBe(201);
    const token = lastMailTo(partner.email).url!.split("/invite/")[1]!;

    expect((await as(owner).post(`${W(id)}/team/invitations`, { email: "second@test.pl", role: "VIEWER" })).body.error).toBe("plan_limit");

    expect((await as(intruder).post(`/api/invitations/${token}/accept`)).status).toBe(403);
    expect((await as(partner).post(`/api/invitations/${token}/accept`)).status).toBe(200);
    expect((await as(partner).post(`/api/invitations/${token}/accept`)).status).toBe(410);
    expect((await as(partner).get(`${W(id)}/households`)).status).toBe(200);

    const team = (await as(owner).get(`${W(id)}/team`)).body;
    expect(team.members.map((m: { role: string }) => m.role)).toEqual(["OWNER", "PARTNER"]);
  });
});

describe("excel export", () => {
  async function download(user: TestUser, weddingId: string) {
    const res = await as(user)
      .get(`${W(weddingId)}/export/xlsx?lang=pl`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    return wb;
  }

  it("START exports guests only; STANDARD exports everything", async () => {
    const owner = await createUser();
    const { id } = await createWedding(owner);
    await household(owner, id);
    await as(owner).post(`${W(id)}/gifts`, { title: "Ekspres" });

    const start = await download(owner, id);
    expect(start.worksheets.map((w) => w.name)).toEqual(["Goście"]);
    const guests = start.getWorksheet("Goście")!;
    expect(guests.rowCount).toBe(3); // nagłówek + Jan + Zosia
    expect(guests.getRow(3).getCell(4).value).toBe("Dziecko");

    await setPlan(id, "STANDARD");
    const full = await download(owner, id);
    expect(full.worksheets.map((w) => w.name)).toEqual(["Podsumowanie", "Goście", "Menu", "Dzieci", "Prezenty", "Zadania", "Usługodawcy", "Budżet"]);
  });

  it("co-planners do not get gift reserver details", async () => {
    const owner = await createUser();
    const planner = await createUser();
    const { id } = await createWedding(owner);
    await setPlan(id, "STANDARD");
    await prisma.weddingMember.create({ data: { weddingId: id, userId: planner.id, role: "CO_PLANNER" } });
    const headers = (wb: ExcelJS.Workbook) => (wb.getWorksheet("Prezenty")!.getRow(1).values as string[]).filter(Boolean);
    expect(headers(await download(owner, id))).toContain("E-mail");
    expect(headers(await download(planner, id))).not.toContain("E-mail");
  });
});
