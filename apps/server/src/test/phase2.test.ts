import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, createUser, createWedding, prisma, type TestUser } from "./helpers";

const W = (id: string) => `/api/weddings/${id}`;
const setPlan = (id: string, plan: "START" | "STANDARD") => prisma.wedding.update({ where: { id }, data: { plan } });

describe("tasks", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createUser();
  });

  it("creates the church path with due dates relative to the wedding date", async () => {
    const { id } = await createWedding(owner, { date: "2030-06-15", ceremonyType: "CHURCH" });
    const tasks = (await as(owner).get(`${W(id)}/tasks`)).body as { templateKey: string; dueDate: string; dueMode: string }[];
    const byKey = new Map(tasks.map((t) => [t.templateKey, t]));
    expect(byKey.get("marriage_course")?.dueDate).toBe("2029-10-18"); // −240 dni
    expect(byKey.get("book_venue")).toBeDefined();
    expect(byKey.has("usc_declaration")).toBe(false);
    expect(byKey.get("photos_pickup")?.dueDate).toBe("2030-08-14"); // +60 dni
    const people = (await as(owner).get(`${W(id)}/assignees`)).body.map((a: { name: string }) => a.name);
    expect(people).toEqual(["Ania", "Tomek"]);
  });

  it("civil path has registry office tasks and no reception tasks", async () => {
    const { id } = await createWedding(owner, { ceremonyType: "CIVIL" });
    const keys = (await as(owner).get(`${W(id)}/tasks`)).body.map((t: { templateKey: string }) => t.templateKey);
    expect(keys).toContain("usc_declaration");
    expect(keys).toContain("book_dinner");
    expect(keys).not.toContain("book_venue");
    expect(keys).not.toContain("banns");
  });

  it("moves relative due dates with the wedding date but keeps manually set ones", async () => {
    const { id, slug } = await createWedding(owner, { date: "2030-06-15" });
    const tasks = (await as(owner).get(`${W(id)}/tasks`)).body as { id: string; templateKey: string; title: string; category: string; dueDate: string }[];
    const rings = tasks.find((t) => t.templateKey === "rings")!;
    const dress = tasks.find((t) => t.templateKey === "dress")!;
    // ręczna zmiana terminu sukni → FIXED
    const put = await as(owner).put(`${W(id)}/tasks/${dress.id}`, { title: dress.title, category: dress.category, dueDate: "2029-12-01" });
    expect(put.body.dueMode).toBe("FIXED");

    const res = await as(owner).patch(W(id), {
      partnerOneName: "Ania",
      partnerTwoName: "Tomek",
      date: "2030-07-15",
      ceremonyType: "CHURCH",
      slug,
      locale: "pl",
      rsvpMode: "BOTH",
    });
    expect(res.status).toBe(200);
    const after = (await as(owner).get(`${W(id)}/tasks`)).body as typeof tasks;
    expect(after.find((t) => t.id === rings.id)!.dueDate).toBe("2030-03-17"); // 15.07 − 120 dni
    expect(after.find((t) => t.id === dress.id)!.dueDate).toBe("2029-12-01");
  });

  it("toggles status, tracks doneAt, and generation is idempotent", async () => {
    const { id } = await createWedding(owner);
    const [first] = (await as(owner).get(`${W(id)}/tasks`)).body;
    const done = await as(owner).patch(`${W(id)}/tasks/${first.id}`, { status: "DONE" });
    expect(done.body.doneAt).toBeTruthy();
    expect((await as(owner).post(`${W(id)}/tasks/generate`)).body.created).toBe(0);

    const custom = await as(owner).post(`${W(id)}/tasks`, { title: "Kupić świece", category: "DECOR", dueDate: "2030-05-01" });
    expect(custom.status).toBe(201);
    const stats = (await as(owner).get(`${W(id)}/stats`)).body;
    expect(stats.tasks.done).toBe(1);
    expect(stats.tasks.total).toBeGreaterThan(40);
  });

  it("rejects assignees from another wedding", async () => {
    const a = await createWedding(owner);
    const b = await createWedding(owner);
    const foreign = (await as(owner).get(`${W(b.id)}/assignees`)).body[0].id;
    const res = await as(owner).post(`${W(a.id)}/tasks`, { title: "X", assigneeId: foreign });
    expect(res.status).toBe(400);
  });

  it("changing the ceremony type and generating adds the new path without duplicates", async () => {
    const { id } = await createWedding(owner, { ceremonyType: "CIVIL" });
    await prisma.wedding.update({ where: { id }, data: { ceremonyType: "CHURCH" } });
    const created = (await as(owner).post(`${W(id)}/tasks/generate`)).body.created;
    expect(created).toBeGreaterThan(5);
    const keys = (await as(owner).get(`${W(id)}/tasks`)).body.map((t: { templateKey: string }) => t.templateKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("banns");
  });
});

describe("budget", () => {
  let owner: TestUser;
  let id: string;

  beforeAll(async () => {
    owner = await createUser();
    ({ id } = await createWedding(owner));
  });

  it("is a paid feature and partner-only", async () => {
    expect((await as(owner).get(`${W(id)}/budget`)).body.error).toBe("feature_unavailable");
    await setPlan(id, "STANDARD");
    const planner = await createUser();
    await prisma.weddingMember.create({ data: { weddingId: id, userId: planner.id, role: "CO_PLANNER" } });
    expect((await as(planner).get(`${W(id)}/budget`)).status).toBe(403);
    expect((await as(owner).get(`${W(id)}/budget`)).status).toBe(200);
  });

  it("sums planned, committed and paid; edits instalments", async () => {
    const b0 = (await as(owner).get(`${W(id)}/budget`)).body;
    expect(b0.categories).toHaveLength(14);
    const venue = b0.categories[0];
    await as(owner).put(`${W(id)}/budget/categories/${venue.id}`, { name: venue.name, planned: "50000" });

    const exp = await as(owner).post(`${W(id)}/budget/expenses`, {
      categoryId: venue.id,
      title: "Sala Dwór",
      amount: "45 000",
      payments: [
        { amount: "5000", dueDate: "2020-01-10", paidAt: "2020-01-09", note: "zaliczka" },
        { amount: "20000", dueDate: "2020-02-01" },
      ],
    });
    expect(exp.status).toBe(201);
    let b = (await as(owner).get(`${W(id)}/budget`)).body;
    expect(b.totals).toEqual({ plannedCents: 50_000_00, committedCents: 45_000_00, paidCents: 5_000_00 });
    const payments = b.categories[0].expenses[0].payments;
    expect(payments[1].overdue).toBe(true);
    expect(b.upcomingPayments).toHaveLength(1);

    // oznaczenie drugiej raty jako zapłaconej + usunięcie pierwszej
    const res = await as(owner).put(`${W(id)}/budget/expenses/${exp.body.id}`, {
      categoryId: venue.id,
      title: "Sala Dwór",
      amount: "45000",
      payments: [{ id: payments[1].id, amount: "20000", dueDate: "2020-02-01", paidAt: "2020-02-01" }],
    });
    expect(res.status).toBe(200);
    b = (await as(owner).get(`${W(id)}/budget`)).body;
    expect(b.totals.paidCents).toBe(20_000_00);
    expect(b.categories[0].expenses[0].payments).toHaveLength(1);

    const tooMuch = await as(owner).post(`${W(id)}/budget/expenses`, {
      categoryId: venue.id,
      title: "X",
      amount: "100",
      payments: [{ amount: "150" }],
    });
    expect(tooMuch.status).toBe(400);
  });

  it("estimates catering from confirmed and maximum headcount", async () => {
    const wedding = (await as(owner).get(W(id))).body;
    await as(owner).patch(W(id), { ...wedding, rsvpMode: "BOTH", platePrice: "300" });
    const h = await as(owner).post(`${W(id)}/households`, {
      name: "Rodzina",
      guests: [
        { firstName: "Jan", lastName: "K", plusOneAllowed: true },
        { firstName: "Zosia", lastName: "K", type: "CHILD", age: 6 },
      ],
    });
    const b = (await as(owner).get(`${W(id)}/budget`)).body;
    expect(b.catering.platePriceCents).toBe(300_00);
    expect(b.catering.confirmedCents).toBe(0);
    // Jan + możliwa osoba towarzysząca + Zosia (50%)
    expect(b.catering.maxCents).toBe(300_00 * 2 + 150_00);
    expect(h.status).toBe(201);
  });
});

describe("vendors", () => {
  it("stores contracts privately and only for members", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const { id } = await createWedding(owner);
    expect((await as(owner).get(`${W(id)}/vendors`)).status).toBe(402);
    await setPlan(id, "STANDARD");

    const v = await as(owner).post(`${W(id)}/vendors`, { category: "PHOTO", name: "Foto Kowalski", email: "foto@test.pl", status: "BOOKED" });
    expect(v.status).toBe(201);

    const notPdf = await as(owner)
      .post(`${W(id)}/vendors/${v.body.id}/contract`)
      .attach("file", Buffer.from("hello"), { filename: "umowa.pdf", contentType: "application/pdf" });
    expect(notPdf.body.error).toBe("invalid_pdf");

    const pdf = Buffer.from("%PDF-1.4\n%fake minimal pdf for test\n");
    const up = await as(owner)
      .post(`${W(id)}/vendors/${v.body.id}/contract`)
      .attach("file", pdf, { filename: "Umowa fotograf.pdf", contentType: "application/pdf" });
    expect(up.body).toMatchObject({ hasContract: true, contractName: "Umowa fotograf.pdf" });
    expect(JSON.stringify(up.body)).not.toContain("contracts/");

    const dl = await as(owner).get(`${W(id)}/vendors/${v.body.id}/contract`).buffer(true);
    expect(dl.status).toBe(200);
    expect(dl.headers["content-type"]).toBe("application/pdf");
    expect((await as(stranger).get(`${W(id)}/vendors/${v.body.id}/contract`)).status).toBe(404);

    const key = (await prisma.vendor.findUniqueOrThrow({ where: { id: v.body.id } })).contractKey!;
    expect((await anon().get(`/media/${key}`)).status).toBe(404);
  });
});

describe("calendar", () => {
  it("merges parts, tasks, meetings and (for the couple) payments", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const { id } = await createWedding(owner, { date: "2030-06-15" });
    await setPlan(id, "STANDARD");
    await prisma.weddingMember.create({ data: { weddingId: id, userId: viewer.id, role: "VIEWER" } });

    const vendor = (await as(owner).post(`${W(id)}/vendors`, { category: "VENUE", name: "Dwór" })).body;
    expect(
      (await as(owner).post(`${W(id)}/calendar/entries`, { title: "Degustacja", startsAt: "2030-06-03T18:00", vendorId: vendor.id })).status,
    ).toBe(201);
    const cat = (await as(owner).get(`${W(id)}/budget`)).body.categories[0].id;
    await as(owner).post(`${W(id)}/budget/expenses`, { categoryId: cat, title: "Sala", amount: "1000", payments: [{ amount: "1000", dueDate: "2030-06-05" }] });

    const items = (await as(owner).get(`${W(id)}/calendar?from=2030-06-01&to=2030-06-30`)).body as { kind: string; title: string; date: string; time: string | null }[];
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds).toEqual(new Set(["PART", "TASK", "ENTRY", "PAYMENT"]));
    expect(items.find((i) => i.kind === "ENTRY")).toMatchObject({ title: "Degustacja (Dwór)", date: "2030-06-03", time: "18:00" });
    expect(items.filter((i) => i.kind === "PART").map((i) => i.time)).toEqual(["15:00", "17:00"]);

    const forViewer = (await as(viewer).get(`${W(id)}/calendar?from=2030-06-01&to=2030-06-30`)).body as { kind: string }[];
    expect(forViewer.some((i) => i.kind === "PAYMENT")).toBe(false);
    expect((await as(viewer).post(`${W(id)}/calendar/entries`, { title: "X", startsAt: "2030-06-03T18:00" })).status).toBe(403);
    expect((await as(owner).get(`${W(id)}/calendar?from=2030-07-01&to=2030-06-01`)).status).toBe(400);
  });
});
