import { expect, test as base, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const MAILPIT = "http://localhost:8035/api/v1";

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Każdy test pada, jeśli w konsoli przeglądarki pojawi się błąd lub nieobsłużony wyjątek. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        // 4xx z API są oczekiwane w części testów (np. zajęty prezent); raportujemy je w UI, nie w konsoli.
        if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) {
          errors.push(m.text());
        }
      });
      await use(errors);
      expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Ostatni mail do adresu (Mailpit), czekając aż dotrze. */
export async function waitForMail(to: string, subjectPart?: string): Promise<{ subject: string; text: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const m = messages.find((x) => !subjectPart || x.Subject.includes(subjectPart));
    if (m) {
      const full = (await (await fetch(`${MAILPIT}/message/${m.ID}`)).json()) as { Subject: string; Text: string };
      return { subject: full.Subject, text: full.Text };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no mail to ${to}${subjectPart ? ` with "${subjectPart}"` : ""}`);
}

export const linkIn = (text: string, pattern: RegExp) => {
  const m = text.match(pattern);
  if (!m) throw new Error(`link ${pattern} not found in mail`);
  return m[0];
};

/** Zmiana pakietu wprost w bazie (płatności dojdą w fazie 5). */
export function setPlan(slug: string, plan: "START" | "STANDARD" | "PREMIUM") {
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "wedding", "-d", "wedding_e2e", "-c", `update wedding set plan='${plan}' where slug='${slug}'`], {
    cwd: new URL("../..", import.meta.url).pathname,
    stdio: "pipe",
  });
}

export const PASSWORD = "haslo-e2e-123";

/** Rejestracja przez UI + aktywacja linkiem z maila. Kończy zalogowanym na /app. */
export async function registerAndVerify(page: Page, email: string, name = "Ania") {
  await page.goto("/register");
  await page.getByLabel("Imię").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło").fill(PASSWORD);
  await page.getByRole("button", { name: "Utwórz konto" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  const mail = await waitForMail(email, "Potwierdź");
  await page.goto(linkIn(mail.text, /http:\/\/\S+verify-email\S+/));
  await expect(page).toHaveURL(/\/app$/);
}

/** Tworzy wesele przez formularz na pulpicie; zwraca slug i id z adresu panelu. */
export async function createWedding(page: Page, opts: { p1?: string; p2?: string; date?: string; ceremony?: string } = {}) {
  await page.getByRole("button", { name: "Utwórz wesele" }).click();
  await page.getByLabel("Imię pierwszej osoby").fill(opts.p1 ?? "Kasia");
  await page.getByLabel("Imię drugiej osoby").fill(opts.p2 ?? "Michał");
  await page.getByLabel("Imię drugiej osoby").blur();
  await page.getByLabel("Data ślubu").fill(opts.date ?? "2027-06-19");
  if (opts.ceremony) await page.getByLabel("Rodzaj ceremonii").selectOption(opts.ceremony);
  const slug = `e2e-${uid()}`;
  await page.getByLabel("Adres strony").fill(slug);
  await page.getByRole("button", { name: "Utwórz", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/w\/[a-z0-9]+$/);
  const id = page.url().split("/app/w/")[1]!;
  return { slug, id };
}
