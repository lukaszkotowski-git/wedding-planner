import { type Browser, type Page } from "@playwright/test";
import { createWedding, expect, linkIn, registerAndVerify, setPlan, test, uid, waitForMail } from "./helpers";

const shot = (name: string) => `screenshots/${name}.png`;

/** Para zakłada wesele z gośćmi i prezentem (przez API, z sesją z UI). */
async function setupWedding(page: Page) {
  await registerAndVerify(page, `para-${uid()}@e2e.test`);
  const { slug, id } = await createWedding(page);
  const api = page.request;
  const put = await api.patch(`/api/weddings/${id}`, {
    data: {
      partnerOneName: "Kasia",
      partnerTwoName: "Michał",
      date: "2027-06-19",
      ceremonyType: "CHURCH",
      slug,
      locale: "pl",
      rsvpMode: "BOTH",
      rsvpDeadline: "2027-05-01",
      welcomeMessage: "Kochani! Z radością zapraszamy Was na nasz ślub i wesele.",
      giftsIntro: "Wasza obecność jest dla nas najważniejsza.",
      cashGiftInfo: "Zamiast kwiatów prosimy o wsparcie podróży poślubnej.",
    },
  });
  expect(put.ok()).toBeTruthy();
  const email = `kowalscy-${uid()}@e2e.test`;
  const h = await api.post(`/api/weddings/${id}/households`, {
    data: {
      name: "Rodzina Kowalskich",
      email,
      guests: [
        { firstName: "Jan", lastName: "Kowalski", plusOneAllowed: true },
        { firstName: "Zosia", lastName: "Kowalska", type: "CHILD", age: 4 },
      ],
    },
  });
  expect(h.ok()).toBeTruthy();
  await api.post(`/api/weddings/${id}/households`, {
    data: { name: "Wiśniewscy", guests: [{ firstName: "Łukasz", lastName: "Wiśniewski" }, { firstName: "Marta", lastName: "Wiśniewska" }] },
  });
  await api.post(`/api/weddings/${id}/gifts`, { data: { title: "Ekspres do kawy", description: "Kolbowy, z młynkiem.", price: "1899", url: "https://example.com/ekspres" } });
  await api.post(`/api/weddings/${id}/gifts`, { data: { title: "Komplet pościeli" } });
  return { slug, id, rsvpUrl: (await h.json()).rsvpUrl as string, householdEmail: email };
}

async function guestPage(browser: Browser, mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: "pl-PL" } : { locale: "pl-PL" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors, close: () => ctx.close() };
}

test("gość: strona wesela → RSVP z osobą towarzyszącą → blokada po wysłaniu", async ({ page, browser }) => {
  const w = await setupWedding(page);
  const guest = await guestPage(browser);
  const g = guest.page;

  await g.goto(`/w/${w.slug}`);
  await expect(g.getByRole("heading", { level: 1 })).toContainText("Kasia");
  await expect(g.getByText("Kochani! Z radością")).toBeVisible();
  await expect(g.getByText("Prosimy o odpowiedź do 1 maja 2027")).toBeVisible();
  await g.screenshot({ path: shot("10-public-desktop"), fullPage: true });

  await g.goto(w.rsvpUrl.replace(/^http:\/\/localhost:\d+/, ""));
  await expect(g.getByText("Zaproszenie: Rodzina Kowalskich")).toBeVisible();
  const jan = g.locator("form > div").filter({ hasText: "Jan Kowalski" });
  const zosia = g.locator("form > div").filter({ hasText: "Zosia Kowalska" });

  // wysłanie bez odpowiedzi → podpowiedź
  await g.getByLabel(/Zgadzam się/).check();
  await g.getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await expect(g.getByText("Zaznacz odpowiedź dla każdej osoby.")).toBeVisible();

  for (const part of ["Ceremonia", "Przyjęcie weselne"]) {
    await jan.getByRole("group", { name: new RegExp(part) }).getByText("Będzie", { exact: true }).click();
  }
  await zosia.getByRole("group", { name: /Ceremonia/ }).getByText("Będzie", { exact: true }).click();
  await zosia.getByRole("group", { name: /Przyjęcie/ }).getByText("Nie będzie").click();
  await jan.getByLabel("Wybór menu").selectOption({ label: "Mięsne" });
  await jan.getByLabel("Alergie / dieta").fill("bez orzechów");
  await jan.getByLabel("Przyjdę z osobą towarzyszącą").check();
  await jan.getByLabel("Imię osoby towarzyszącej").fill("Ewa");
  await jan.getByLabel("Nazwisko osoby towarzyszącej").fill("Nowak");
  await jan.getByLabel("Wybór menu").nth(1).selectOption({ label: "Wegetariańskie" });
  await zosia.getByLabel("Wybór menu").selectOption({ label: "Menu dziecięce" });
  await g.getByLabel("Potrzebujemy noclegu").check();
  await g.screenshot({ path: shot("11-rsvp-filled"), fullPage: true });
  await g.getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await expect(g.getByText("Dziękujemy! Odpowiedź została zapisana.")).toBeVisible();

  const mail = await waitForMail(w.householdEmail, "Potwierdzenie odpowiedzi");
  expect(mail.text).toContain("Ewa Nowak: Ceremonia, Przyjęcie weselne");
  expect(mail.text).toContain("Zosia Kowalska: Ceremonia");

  await g.reload();
  await expect(g.getByText("Odpowiedź została już wysłana")).toBeVisible();

  // para widzi odpowiedź w panelu
  await page.goto(`/app/w/${w.id}/guests`);
  const card = page.locator("div.rounded-xl").filter({ hasText: "Rodzina Kowalskich" });
  await expect(card.getByText("Będzie", { exact: true })).toBeVisible();
  await expect(card.getByText("Ewa Nowak")).toBeVisible();
  await expect(card.getByText("(bez orzechów)")).toBeVisible();
  await page.goto(`/app/w/${w.id}`);
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: shot("12-overview-with-rsvp"), fullPage: true });

  expect(guest.errors).toEqual([]);
  await guest.close();
});

test("gość: wyszukanie zaproszenia z literówką i bez polskich znaków", async ({ page, browser }) => {
  const w = await setupWedding(page);
  const guest = await guestPage(browser);
  const g = guest.page;
  await g.goto(`/w/${w.slug}#rsvp`);
  await g.getByLabel("Imię").fill("lukasz");
  await g.getByLabel("Nazwisko").fill("wisniewsky");
  await g.getByRole("button", { name: "Znajdź zaproszenie" }).click();
  await g.getByRole("link", { name: "Łukasz W., Marta W." }).click();
  await expect(g.getByText("Zaproszenie: Wiśniewscy")).toBeVisible();

  // nieznana osoba → prośba o dołączenie
  await g.goto(`/w/${w.slug}#rsvp`);
  await g.getByLabel("Imię").fill("Anna");
  await g.getByLabel("Nazwisko").fill("Zielińska");
  await g.getByRole("button", { name: "Znajdź zaproszenie" }).click();
  await expect(g.getByText("Nie znaleźliśmy Cię na liście gości.")).toBeVisible();
  await g.getByRole("button", { name: "Poproś o dodanie do listy" }).click();
  await g.getByLabel("Twój e-mail").fill(`anna-${uid()}@e2e.test`);
  await g.getByLabel(/Zgadzam się/).check();
  await g.getByRole("button", { name: "Wyślij prośbę" }).click();
  await expect(g.getByText("Prośba wysłana.")).toBeVisible();

  await page.goto(`/app/w/${w.id}`);
  await expect(page.getByText("1 prośba o dołączenie czeka na decyzję")).toBeVisible();
  await guest.close();
});

test("gość: rezerwacja prezentu z potwierdzeniem mailem", async ({ page, browser }) => {
  const w = await setupWedding(page);
  const guest = await guestPage(browser);
  const g = guest.page;
  const email = `basia-${uid()}@e2e.test`;

  await g.goto(`/w/${w.slug}#gifts`);
  const gift = g.locator("article").filter({ hasText: "Ekspres do kawy" });
  await expect(gift.getByText("ok. 1899 zł")).toBeVisible();
  await gift.getByRole("button", { name: "Rezerwuję" }).click();
  const d = g.getByRole("dialog");
  await d.getByLabel("Imię i nazwisko").fill("Ciocia Basia");
  await d.getByLabel("Twój e-mail").fill(email);
  await d.getByLabel(/Zgadzam się/).check();
  await d.getByRole("button", { name: "Wyślij link potwierdzający" }).click();
  await expect(d.getByText(`Sprawdź skrzynkę ${email}`)).toBeVisible();
  await d.getByRole("button", { name: "Zamknij" }).first().click();
  // oczekująca rezerwacja już blokuje prezent
  await expect(gift.getByText("Zarezerwowany")).toBeVisible();

  const mail = await waitForMail(email, "Potwierdź rezerwację");
  await g.goto(linkIn(mail.text, /http:\/\/\S+confirm=\S+/).replace(/^http:\/\/localhost:\d+/, ""));
  await expect(g.getByText("Rezerwacja prezentu „Ekspres do kawy” potwierdzona.")).toBeVisible();
  await g.screenshot({ path: shot("13-gift-confirmed") });

  // para widzi rezerwującego
  await page.goto(`/app/w/${w.id}/gifts`);
  await expect(page.getByText("Zarezerwował(a): Ciocia Basia")).toBeVisible();

  // anulowanie linkiem z drugiego maila
  const confirmed = await waitForMail(email, "Prezent zarezerwowany");
  await g.goto(linkIn(confirmed.text, /http:\/\/\S+cancel=\S+/).replace(/^http:\/\/localhost:\d+/, ""));
  await expect(g.getByText("została anulowana")).toBeVisible();
  await g.goto(`/w/${w.slug}#gifts`);
  await expect(g.locator("article").filter({ hasText: "Ekspres do kawy" }).getByRole("button", { name: "Rezerwuję" })).toBeVisible();
  await guest.close();
});

test("@mobile gość na telefonie: strona i formularz RSVP bez poziomego przewijania", async ({ page, browser }) => {
  const w = await setupWedding(page);
  setPlan(w.slug, "STANDARD");
  const guest = await guestPage(browser, true);
  const g = guest.page;
  for (const [path, name] of [
    [`/w/${w.slug}`, "20-public-mobile"],
    [w.rsvpUrl.replace(/^http:\/\/localhost:\d+/, ""), "21-rsvp-mobile"],
  ] as const) {
    await g.goto(path);
    await expect(g.getByRole("heading").first()).toBeVisible();
    const offenders = await g.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll("body *")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.right > vw + 0.5)
        .map(({ el, r }) => `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> right=${Math.round(r.right)} "${(el.textContent ?? "").trim().slice(0, 30)}"`)
        .slice(0, 5);
    });
    expect(offenders, `elementy wystające poza ekran na ${path}`).toEqual([]);
    await g.screenshot({ path: shot(name), fullPage: true });
  }
  expect(guest.errors).toEqual([]);
  await guest.close();
});
