import { createWedding, expect, registerAndVerify, setPlan, test, uid } from "./helpers";

const shot = (name: string) => `screenshots/${name}.png`;

test("para: rejestracja → wesele → goście → zadania → kalendarz → budżet → usługodawcy → eksport", async ({ page }) => {
  const email = `para-${uid()}@e2e.test`;
  await registerAndVerify(page, email);
  await page.screenshot({ path: shot("01-dashboard-empty"), fullPage: true });

  const { slug } = await createWedding(page);
  await expect(page.getByRole("heading", { name: "Kasia & Michał" })).toBeVisible();
  await expect(page.getByText("Dodaj pierwszych gości")).toBeVisible();
  // domyślne zadania są od razu na pulpicie
  await expect(page.getByText(/0 z \d+ zrobione/)).toBeVisible();
  await page.screenshot({ path: shot("02-overview-empty"), fullPage: true });

  // ─── Goście ───
  await page.getByRole("link", { name: "Goście" }).click();
  await page.getByRole("button", { name: "Dodaj zaproszenie" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nazwa zaproszenia").fill("Rodzina Kowalskich");
  await dialog.getByLabel("Imię").first().fill("Jan");
  await dialog.getByLabel("Nazwisko").first().fill("Kowalski");
  await dialog.getByLabel("Może przyjść z osobą towarzyszącą").check();
  await dialog.getByRole("button", { name: "Dodaj dziecko" }).click();
  await dialog.getByLabel("Imię").nth(1).fill("Zosia");
  await dialog.getByLabel("Wiek w dniu ślubu").fill("4");
  await dialog.getByLabel("Potrzebne krzesełko").check();
  await dialog.getByLabel("E-mail kontaktowy").fill("kowalscy@e2e.test");
  await page.screenshot({ path: shot("03-household-dialog") });
  await dialog.getByRole("button", { name: "Zapisz" }).click();
  await expect(dialog).toBeHidden();

  const card = page.locator("div.rounded-xl").filter({ hasText: "Rodzina Kowalskich" });
  await expect(card.getByText("Czeka")).toBeVisible();
  await expect(card.getByText("Zosia Kowalski")).toBeVisible();
  await expect(card.getByText("4 l.")).toBeVisible();
  await expect(page.getByText("(3 osoby)")).toBeHidden(); // plus-one jeszcze nie dopisany
  await expect(page.getByText("(2 osoby)")).toBeVisible();
  await page.screenshot({ path: shot("04-guests"), fullPage: true });

  // wyszukiwarka
  await page.getByPlaceholder("Szukaj po nazwisku").fill("nowak");
  await expect(card).toBeHidden();
  await page.getByPlaceholder("Szukaj po nazwisku").fill("");

  // ─── Zadania ───
  await page.getByRole("link", { name: "Zadania" }).click();
  await expect(page.getByRole("heading", { name: "Po terminie" })).toBeVisible();
  const total = Number((await page.getByText(/0 z \d+ zrobione/).textContent())!.match(/z (\d+)/)![1]);
  expect(total).toBeGreaterThan(40);
  await page.getByRole("checkbox", { name: "Ustalcie budżet wesela" }).check();
  await expect(page.getByText(`1 z ${total} zrobione`)).toBeVisible();
  await page.getByRole("button", { name: "Dodaj zadanie" }).click();
  await page.getByRole("dialog").getByLabel("Zadanie").fill("Kupić świece do dekoracji");
  await page.getByRole("dialog").getByLabel("Termin").fill("2027-05-01");
  await page.getByRole("dialog").getByLabel("Osoba").selectOption({ label: "Kasia" });
  await page.getByRole("dialog").getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByRole("button", { name: "Kupić świece do dekoracji" })).toBeVisible();
  await page.screenshot({ path: shot("05-tasks"), fullPage: true });

  // ─── Kalendarz: dzień ślubu ───
  await page.getByRole("link", { name: "Kalendarz" }).click();
  for (let i = 0; i < 24 && !(await page.getByRole("heading", { name: /czerwiec 2027/i }).isVisible()); i++) {
    await page.getByRole("button", { name: "Następny miesiąc" }).click();
  }
  await page.getByRole("button", { name: /sobota, 19 czerwca 2027/ }).click();
  await expect(page.getByText("Ceremonia", { exact: true })).toBeVisible();
  await expect(page.getByText("Przyjęcie weselne", { exact: true })).toBeVisible();
  await page.screenshot({ path: shot("06-calendar"), fullPage: true });

  // ─── Budżet: pakiet Start → informacja; Standard → pełny moduł ───
  await page.getByRole("link", { name: "Budżet" }).click();
  await expect(page.getByText("Dostępne w pakiecie Standard")).toBeVisible();
  setPlan(slug, "STANDARD");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kategorie" })).toBeVisible();
  await page.getByRole("button", { name: "Sala i catering" }).click();
  await page.getByRole("button", { name: "Dodaj koszt" }).click();
  const exp = page.getByRole("dialog");
  await exp.getByLabel("Nazwa").fill("Sala Dwór");
  await exp.getByLabel("Kwota całkowita (zł)").fill("45000");
  await exp.getByRole("button", { name: "Dodaj ratę" }).click();
  await exp.getByLabel("Kwota (zł)").fill("5000");
  await exp.getByLabel("Opis (np. zaliczka)").fill("zaliczka");
  await exp.getByRole("button", { name: "Zapisz" }).click();
  await expect(exp).toBeHidden();
  await expect(page.getByText("Sala Dwór: 5000 zł")).toBeVisible(); // nadchodzące płatności
  await page.getByRole("button", { name: "Zapłacone" }).click();
  await expect(page.getByText("Brak zaplanowanych płatności.")).toBeVisible();
  await page.getByLabel("Cena talerza dorosłego (zł)").fill("300");
  await page.getByRole("button", { name: "Zapisz" }).click();
  // Jan + możliwa osoba towarzysząca + Zosia (4 lata → 50%)
  await expect(page.getByText("750 zł")).toBeVisible();
  await page.screenshot({ path: shot("07-budget"), fullPage: true });

  // ─── Usługodawcy ───
  await page.getByRole("link", { name: "Usługodawcy" }).click();
  await page.getByRole("button", { name: "Dodaj usługodawcę" }).click();
  const vd = page.getByRole("dialog");
  await vd.getByLabel("Kategoria").selectOption({ label: "Fotograf" });
  await vd.getByLabel("Nazwa").fill("Studio Kadr");
  await vd.getByLabel("Telefon").fill("+48 600 100 200");
  await vd.getByRole("button", { name: "Zapisz" }).click();
  await expect(vd.getByText("Umowa:")).toBeVisible(); // po zapisie można wgrać umowę
  await vd.getByRole("button", { name: "Zamknij" }).first().click();
  await expect(page.getByRole("heading", { name: "Studio Kadr" })).toBeVisible();
  await page.screenshot({ path: shot("08-vendors"), fullPage: true });

  // ─── Eksport ───
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Eksport do Excela" }).click();
  expect((await download).suggestedFilename()).toMatch(new RegExp(`^wesele-${slug}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`));
});

test("wylogowany użytkownik nie wejdzie do panelu", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail").fill("nie-ma@e2e.test");
  await page.getByLabel("Hasło").fill("zle-haslo-123");
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(page.getByText(/invalid|nieprawidłow/i)).toBeVisible();
});
