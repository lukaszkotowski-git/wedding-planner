import request from "supertest";
import { vi } from "vitest";
import type { ActionMail } from "../lib/mail";

/** Maile nie wychodzą w testach; zapisujemy je, żeby wyciągać z nich linki. */
export const sentMails: ActionMail[] = [];

vi.mock("../lib/mail", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/mail")>();
  return {
    ...original,
    sendActionMail: vi.fn(async (m: ActionMail) => void sentMails.push(m)),
    sendMailInBackground: vi.fn((m: ActionMail) => void sentMails.push(m)),
  };
});

const { createApp } = await import("../app");
const { auth } = await import("../lib/auth");
const { prisma } = await import("../lib/db");

export const app = createApp();
export { prisma };

let seq = 0;

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

export async function createUser(email = `user${Date.now()}-${seq++}@test.pl`): Promise<TestUser> {
  const { user } = await auth.api.signUpEmail({ body: { name: email.split("@")[0]!, email, password: "haslo12345" } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  const res = await auth.api.signInEmail({ body: { email, password: "haslo12345" }, asResponse: true });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { id: user.id, email, cookie };
}

export const as = (user: TestUser) => ({
  get: (url: string) => request(app).get(url).set("Cookie", user.cookie),
  post: (url: string, body?: object) => request(app).post(url).set("Cookie", user.cookie).send(body),
  put: (url: string, body?: object) => request(app).put(url).set("Cookie", user.cookie).send(body),
  patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", user.cookie).send(body),
  delete: (url: string) => request(app).delete(url).set("Cookie", user.cookie),
});

export const anon = () => request(app);

export async function createWedding(user: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await as(user).post("/api/weddings", {
    partnerOneName: "Ania",
    partnerTwoName: "Tomek",
    date: "2030-06-15",
    ceremonyType: "CHURCH",
    slug: `wesele-${Date.now()}-${seq++}`,
    locale: "pl",
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`createWedding failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; slug: string };
}

export function lastMailTo(email: string) {
  const m = sentMails.filter((x) => x.to === email).at(-1);
  if (!m) throw new Error(`no mail to ${email}`);
  return m;
}

export const tokenFrom = (url: string | undefined, key: string) => new URL(url!).searchParams.get(key)!;
