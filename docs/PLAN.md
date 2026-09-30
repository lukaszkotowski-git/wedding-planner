# Wedding Planner: plan produktu i implementacji

> Status: szkic 3 (2026-09-30). Fazy 0 i 1 zrealizowane. Pozostałe otwarte pytania w sekcji 11.

## 1. Decyzje produktowe

| Obszar | Decyzja |
|---|---|
| Model | SaaS dla wielu par, docelowo płatny |
| Języki | PL + EN (UI, szablony zadań, maile, strona gościa) |
| Urządzenia | Web responsywny (bez aplikacji natywnej) |
| Hosting | Własny VPS z Dokploy |
| RSVP | Dwa tryby: **dedykowany link** (token gospodarstwa) i **otwarty formularz** |
| Osoba towarzysząca | Tylko gdy para zaznaczy zgodę dla konkretnego gościa |
| Dzieci | Osobny moduł: wiek, progi cenowe, menu dziecięce, krzesełko, miejsce przy stole |
| Menu | Konfigurowalna lista dań + pole na alergie/dietę |
| Zmiana odpowiedzi RSVP | Gość **nie** może zmienić; para może odblokować lub edytować ręcznie |
| Prezenty | Rezerwacja wymaga maila; para widzi, kto zarezerwował; prezenty składkowe |
| Śluby | Osobne ścieżki zadań: cywilny / kościelny (konkordatowy) / cywilny + przyjęcie |
| Zadania | Przypisanie do osoby (członek ekipy lub osoba bez konta, np. świadek) |
| Kalendarz | Tylko w aplikacji (bez synchronizacji z Google) |
| Excel | Tylko eksport |
| Zakres | MVP najpierw, docelowo wszystkie usprawnienia z listy |
| Płatność | Jednorazowo za wesele, 3 pakiety (sekcja 1a) |
| Wedding plannerzy (B2B) | Nie na start, w backlogu (sekcja 9, „Backlog”) |
| Adres strony | `/w/:slug`; subdomeny i własne domeny później |
| Tryb otwarty RSVP | Samo dopasowanie imienia i nazwiska wystarczy (bez dodatkowej weryfikacji) |
| Rezerwacja prezentu | Potwierdzana linkiem z maila |
| Koperta / fundusz | Tylko informacja + deklaracje kwot, bez obsługi płatności |
| Maile | Gmail SMTP na start; transport przez env, docelowo dostawca transakcyjny |

## 1a. Pakiety

Jednorazowa opłata za wesele, ważna do 12 mies. po dacie ślubu. Zmiana na wyższy pakiet = dopłata różnicy.
Źródło prawdy w kodzie: `packages/shared/src/plans.ts` (serwer egzekwuje, klient wyświetla).

| | **Start** (0 zł) | **Standard** (149 zł) | **Premium** (249 zł) |
|---|---|---|---|
| Goście | 40 | 200 | 500 |
| Prezenty | 10 | bez limitu | bez limitu |
| RSVP (link dedykowany + otwarty), menu, dzieci | ✅ | ✅ | ✅ |
| Lista zadań + kalendarz | ✅ | ✅ | ✅ |
| Eksport Excel | tylko goście | pełny | pełny |
| Prezenty składkowe | ❌ | ✅ | ✅ |
| Budżet + usługodawcy | ❌ | ✅ | ✅ |
| Import gości z Excela/CSV | ❌ | ✅ | ✅ |
| Przypomnienia mailowe RSVP | ❌ | ✅ | ✅ |
| Lista podziękowań | ❌ | ✅ | ✅ |
| Członkowie zespołu (poza właścicielem) | 1 | 3 | bez limitu |
| Motywy strony wydarzenia | 1 | 3 | wszystkie |
| Plan stołów + eksport PDF | ❌ | ❌ | ✅ |
| Strona chroniona hasłem | ❌ | ❌ | ✅ |
| Stopka „Stworzone w …” | tak | nie | nie |
| Przechowywanie danych gości po ślubie | 3 mies. | 12 mies. | 24 mies. |

Uzasadnienie: Start pozwala przetestować cały główny przepływ (RSVP + prezenty) na małym weselu.
Standard pokrywa typowe polskie wesele (100–180 gości). Premium sprzedaje się planem stołów, który
jest najbardziej pracochłonną częścią tuż przed ślubem.

## 2. Stack

Bazowy stack użytkownika plus uzupełnienia:

| Warstwa | Technologia |
|---|---|
| Frontend | React 18, Vite 7, TypeScript, wouter, TanStack Query |
| UI | Tailwind 3, shadcn/ui (Radix), lucide-react, next-themes |
| Animacje | GSAP, framer-motion, View Transitions API (strona gościa, nie panel) |
| Backend | Express 5 + TypeScript, jeden proces serwuje API i klienta |
| Baza | PostgreSQL 16 + Prisma 6 |
| Auth | Better Auth (e-mail + hasło, Google), nodemailer |
| **Walidacja** | **zod**: wspólne schematy klient/serwer w pakiecie `shared` |
| **Formularze** | react-hook-form + @hookform/resolvers/zod |
| **i18n** | i18next + react-i18next (klient), i18next na serwerze (maile, eksport) |
| **Zadania w tle** | **pg-boss** (kolejka na Postgresie, bez Redisa): przypomnienia, maile, retencja RODO |
| **Pliki** | S3-compatible przez `@aws-sdk/client-s3`. Dev: SeaweedFS (MinIO nie publikuje już obrazów Dockera). Prod: Cloudflare R2, Garage lub SeaweedFS w Dokploy. `sharp`: WebP max 1200 px, bez EXIF |
| **Excel** | exceljs (streaming, wiele arkuszy) |
| **PDF** | pdfmake lub @react-pdf/renderer (plan stołów, lista gości dla sali) |
| **Kalendarz** | FullCalendar (widok miesiąc/tydzień/lista) |
| **Plan stołów** | dnd-kit |
| **QR** | qrcode (PNG/SVG do zaproszeń) |
| **Anty-spam** | express-rate-limit (10/min na publicznych formularzach); Cloudflare Turnstile w fazie 3 |
| **Płatności** | Stripe (karty, BLIK, Przelewy24): patrz 11 |
| **Maile** | nodemailer przez SMTP. Start: Gmail (hasło aplikacji, limit ~500/dzień, Workspace ~2000). Przed publicznym startem: SES / Postmark / Brevo (tylko zmiana env) |
| **Testy** | Vitest (unit/API, supertest), Playwright (e2e ścieżek RSVP i rezerwacji) |
| **Obserwowalność** | pino (logi), Sentry (opcjonalnie, self-hosted GlitchTip na Dokploy) |

### ⚠️ Zmiana: routing bez hasha

Hash routing (`/#/`) nie nadaje się do publicznych stron wydarzeń:
- linki udostępniane w Messengerze/WhatsAppie nie pokażą podglądu (OG tags), bo serwer nie widzi ścieżki,
- brzydkie URL-e na zaproszeniach i w kodach QR,
- brak możliwości SEO dla landing page SaaS.

Rozwiązanie: wouter w trybie browser history, Express zwraca `index.html` jako fallback. Dla `/w/:slug` serwer wstrzykuje meta OG (tytuł, data, zdjęcie pary) do HTML przed wysłaniem. Bez SSR, wystarczy podmiana w szablonie.

## 3. Struktura repozytorium

npm workspaces:

```
wedding-planner/
├── apps/
│   ├── web/            # React + Vite (panel pary + strona gościa + landing)
│   └── server/         # Express 5 API, Prisma (schema, migracje, seed), joby pg-boss, serwowanie web/dist
├── packages/
│   └── shared/         # schematy zod, pakiety/limity, role, tłumaczenia PL/EN (web + maile)
├── docs/
├── Dockerfile          # multi-stage: build web + server → jeden obraz
└── docker-compose.yml  # lokalnie: postgres :5442, s3 (SeaweedFS) :9010, mailpit :1035/:8035
```

## 4. Model danych (zarys)

```
── Konta i tenancy ─────────────────────────────────────────────
User            (Better Auth: id, email, name, locale)
Wedding         id, slug (unikalny), title, date, timezone, locale domyślny,
                ceremonyType (CIVIL | CHURCH | CIVIL_RECEPTION_ONLY),
                rsvpMode (DEDICATED | OPEN | BOTH), rsvpDeadline,
                giftVisibility, plan (FREE | PREMIUM), status, deletedAt
WeddingMember   weddingId, userId, role (OWNER | PARTNER | CO_PLANNER | VIEWER)
Invitation      zaproszenie do zespołu (email, rola, token, expiresAt)
Assignee        osoba do zadań bez konta (np. "Świadek Kasia"); opcjonalnie userId

── Części wydarzenia ─────────────────────────────────────────────
EventPart       weddingId, name (Ślub / Wesele / Poprawiny), startsAt, endsAt,
                location, address, lat/lng, order
EventSchedule   harmonogram dnia (godzina, punkt programu), per EventPart

── Goście ──────────────────────────────────────────────────────
Household       weddingId, name ("Rodzina Kowalskich"), token (dedykowany link),
                email, phone, side (BRIDE | GROOM | BOTH), tags, locale,
                respondedAt, lockedAt, source (IMPORTED | MANUAL | OPEN_FORM)
Guest           householdId, firstName, lastName, type (ADULT | CHILD),
                birthDate / age, plusOneAllowed, isPlusOne, plusOneOfId,
                mealOptionId, dietNotes, needsHighChair, needsSeat,
                needsAccommodation, needsTransport, notes
GuestEventRsvp  guestId, eventPartId, status (PENDING | YES | NO)
JoinRequest     tryb otwarty: zgłoszenie spoza listy → akceptacja pary
MealOption      weddingId, name (pl/en), forChildren, order, active
ChildPriceTier  weddingId, fromAge, toAge, pricePercent (np. 0–3: 0%, 4–10: 50%)

── Prezenty ─────────────────────────────────────────────────────
Gift            weddingId, title, description, url, imageKey, price, currency,
                isGroupGift, targetAmount, quantity, order, hidden
GiftReservation giftId, name, email, amount (dla składkowych), status
                (PENDING_EMAIL | CONFIRMED | CANCELLED), cancelToken, confirmedAt
Wedding.cashGift / honeymoonFund: tekst + opcjonalnie numer konta / cel

── Planowanie ───────────────────────────────────────────────────
TaskTemplate    globalny: key, title/desc (pl/en), ceremonyTypes[], offsetDays,
                category, order
Task            weddingId, templateKey?, title, description, dueDate,
                dueMode (RELATIVE | FIXED), offsetDays, category,
                assigneeId, status (TODO | IN_PROGRESS | DONE), doneAt, order
CalendarEntry   weddingId, title, startsAt, endsAt, type (MEETING | PAYMENT | CUSTOM)
                → kalendarz = CalendarEntry ∪ Task.dueDate ∪ Payment.dueDate ∪ EventPart
Vendor          weddingId, category, name, contactPerson, phone, email, url,
                notes, contractKey, status (CONSIDERING | BOOKED | REJECTED)
BudgetCategory  weddingId, name, planned
Expense         categoryId, vendorId?, title, amount, paidAmount
Payment         expenseId, amount, dueDate, paidAt (zaliczka / dopłata)

── Stoły ────────────────────────────────────────────────────────
Table           weddingId, name, shape (ROUND | RECT), seats, x, y, rotation
SeatAssignment  tableId, guestId, seatIndex

── Po weselu ────────────────────────────────────────────────────
ThankYou        weddingId, householdId, giftDescription, sentAt
Wedding.albumUrl

── SaaS ─────────────────────────────────────────────────────────
Subscription / Purchase   weddingId, provider, externalId, status, amount
AuditLog        kto, co, kiedy (ważne przy RODO i sporach)
ConsentLog      zgody gości (treść wersji, timestamp, IP-hash)
```

**Kluczowa reguła multi-tenancy:** każdy endpoint panelu przechodzi przez middleware
`requireWeddingRole(minRole)`, który ładuje `WeddingMember` i wstrzykuje `req.wedding`.
Każde zapytanie Prisma filtruje po `weddingId` przez helper, nigdy przez ręczne `where`.
Test e2e: użytkownik A nie widzi danych wesela B (dla każdego zasobu).

## 5. Role i uprawnienia

| Akcja | OWNER | PARTNER | CO_PLANNER | VIEWER |
|---|---|---|---|---|
| Ustawienia wesela, płatności, usunięcie | ✅ | ✅ (bez usuwania) | ❌ | ❌ |
| Goście, RSVP, stoły | ✅ | ✅ | ✅ | 👁 |
| Prezenty, kto zarezerwował | ✅ | ✅ | ⚙️ ukryte domyślnie | ❌ |
| Budżet | ✅ | ✅ | ⚙️ | ❌ |
| Zadania, kalendarz, usługodawcy | ✅ | ✅ | ✅ | 👁 |
| Eksport Excel | ✅ | ✅ | ✅ | ❌ |

⚙️ = konfigurowalne przez OWNER (np. świadek nie powinien widzieć budżetu ani prezentów).

## 6. Przepływy publiczne (bez logowania)

### 6.1 Strona wydarzenia `/w/:slug`
Hero (imiona, data, zdjęcie, odliczanie), harmonogram, lokalizacje z mapą, dress code,
FAQ, nocleg/dojazd, lista prezentów, przycisk RSVP. Język: parametr `?lang=`, domyślnie
locale gospodarstwa, potem ustawienie wesela, potem przeglądarka.
Opcja: strona chroniona hasłem (np. „wpisz kod z zaproszenia”).

### 6.2 RSVP: link dedykowany `/w/:slug/r/:token`
1. Gość widzi swoje gospodarstwo (np. Jan, Anna, Zosia (5 l.)).
2. Dla każdej osoby i każdej części wydarzenia: będzie / nie będzie.
3. Menu z listy (dzieci widzą opcje `forChildren`), alergie.
4. Jeśli `plusOneAllowed`: imię i nazwisko osoby towarzyszącej + menu.
5. Nocleg / transport, uwagi, zgoda RODO (checkbox, zapis do ConsentLog).
6. Podsumowanie, potem **wyślij** (ostateczne, bez możliwości edycji), mail z potwierdzeniem.
7. Ponowne wejście pokazuje odpowiedź w trybie tylko do odczytu + „skontaktuj się z parą, aby zmienić”.

### 6.3 RSVP: tryb otwarty `/w/:slug/rsvp`
1. Gość wpisuje imię i nazwisko → dopasowanie (fuzzy, `pg_trgm`) do listy gości.
2. Dopasowanie wystarczy (decyzja: bez dodatkowej weryfikacji) → ten sam formularz co 6.2.
   Przy kilku kandydatach gość wybiera swoje gospodarstwo z listy (bez ujawniania pozostałych danych).
3. Brak dopasowania → `JoinRequest` → para akceptuje/odrzuca w panelu → mail do gościa z linkiem dedykowanym.
4. Rate limit per IP (Turnstile w fazie 3).

### 6.4 Rezerwacja prezentu
1. Gość klika „Rezerwuję”, podaje imię + e-mail (+ kwotę dla składkowego).
2. Rezerwacja „PENDING_EMAIL” blokuje prezent na 30 min; kliknięcie w link z maila → CONFIRMED. Brak kliknięcia → zwolnienie (job pg-boss).
3. Mail zawiera link do anulowania (cancelToken).
4. Składkowe: pasek postępu `sum(amount) / targetAmount`, zamknięcie po osiągnięciu celu.
5. Publicznie: „zarezerwowane” / „zebrano 60%”; para w panelu widzi kto i ile.

## 7. Szablony zadań

- Seed w `packages/db/seed/tasks.{pl,en}.ts`, ok. 60–80 zadań, każde z `offsetDays` względem daty ślubu i `ceremonyTypes`.
- Przykłady ścieżek:
  - **wspólne:** sala, catering, fotograf/kamerzysta, zespół/DJ, zaproszenia, obrączki, stroje, fryzjer/makijaż, noclegi, transport, lista gości, plan stołów, podziękowania.
  - **cywilny:** rezerwacja terminu w USC, zapewnienie o braku przeszkód (do 6 mies. ważności), świadkowie.
  - **kościelny/konkordatowy:** nauki przedmałżeńskie, poradnia rodzinna, spisanie protokołu w parafii, zapowiedzi, zaświadczenie z USC dla parafii, dekrety/licencja (jeśli inna parafia), dopełnienie w USC po ślubie.
- Przy tworzeniu wesela generowane są `Task` z `dueMode: RELATIVE`. Zmiana daty ślubu przelicza terminy zadań RELATIVE, które nie zostały ręcznie zmienione (FIXED).
- Zadanie po terminie i niewykonane: czerwony badge + opcjonalny mail tygodniowy „co przed Wami”.
- Wersjonowanie szablonów: nowe zadania w szablonie nie dopisują się same do istniejących wesel (opcja „zaproponuj nowe zadania”).

## 8. Eksport do Excela

Jeden przycisk „Eksportuj wszystko”, do tego eksport pojedynczych arkuszy. Plik `wesele-<slug>-<data>.xlsx`:

| Arkusz | Zawartość |
|---|---|
| Podsumowanie | liczby: zaproszeni / potwierdzeni / odmowy / brak odpowiedzi, dorośli/dzieci, menu per danie, nocleg/transport, % zadań, budżet |
| Goście | wiersz = osoba: gospodarstwo, strona, typ, wiek, RSVP per część, menu, dieta, stół, nocleg, transport |
| Menu dla sali | pivot: danie × liczba, lista alergii z nazwiskami i stołami |
| Dzieci | wiek, próg cenowy, krzesełko, menu |
| Prezenty | prezent, cena, status, kto zarezerwował, e-mail, kwota (składkowe) |
| Zadania | zadanie, kategoria, termin, osoba, status |
| Budżet | kategoria, plan, wydano, zapłacono, pozostało + harmonogram płatności |
| Usługodawcy | kontakty i statusy |
| Stoły | stół → lista gości |
| Podziękowania | gospodarstwo, prezent, wysłano? |

Nagłówki pogrubione, zamrożony pierwszy wiersz, autofiltr, szerokości kolumn, język zgodny z UI.

## 9. Fazy realizacji

### Faza 0: Fundament ✅
- [x] Monorepo npm workspaces, TS strict, Vitest
- [ ] ESLint/Prettier
- [x] docker-compose: Postgres, S3 (SeaweedFS), Mailpit
- [x] Prisma + migracja `init` (Better Auth + Wedding + WeddingMember)
- [x] Express 5: moduły, błędy, walidacja zod, pino (z redakcją cookies), rate limit, helmet
- [x] Better Auth (email+hasło, weryfikacja maila, reset hasła, Google opcjonalnie)
- [x] i18n PL/EN w kliencie i w mailach
- [x] Layout, routing bez hasha, motyw jasny/ciemny, przełącznik języka
- [x] Tworzenie wesela + lista wesel + `requireWeddingRole` (izolacja sprawdzona)
- [x] Strona `/w/:slug` z meta OG wstrzykiwanymi przez serwer
- [x] Dockerfile (przetestowany lokalnie, migracje przy starcie)
- [ ] Deploy na Dokploy (staging): wymaga domeny i dostępu do VPS
- [ ] Strona resetu hasła w UI

### Faza 1: MVP („można wysłać zaproszenia”) ✅
- [x] Onboarding: tworzenie wesela z domyślnymi częściami (ceremonia 15:00, przyjęcie 17:00), menu (mięsne, wege, dziecięce) i progami dzieci (0–3: 0%, 4–12: 50%)
- [x] Członkowie zespołu + zaproszenia mailowe (akceptuje tylko konto z tym samym e-mailem, limit pakietu)
- [x] Części wydarzenia + lokalizacje (czas „ścienny”, bez przesunięć strefowych)
- [x] Strona wydarzenia `/w/:slug`: powitanie, plan dnia z mapą, RSVP, prezenty, koperta
- [x] Goście: gospodarstwa, osoby, dzieci (wiek, krzesełko, osobne miejsce), zgoda na +1, strony, tagi, zaproszenie na wybrane części
- [x] Menu konfigurowalne (aktywne/nieaktywne, dziecięce) + progi cenowe dzieci
- [x] RSVP dedykowany (token 22 znaki + QR SVG, regeneracja linku) i otwarty (dopasowanie trigramowe + prośby o dołączenie)
- [x] Blokada odpowiedzi po wysłaniu, odblokowanie przez parę, termin RSVP
- [x] Prezenty: CRUD, zdjęcia (S3 + WebP), rezerwacja z potwierdzeniem mailem (30 min), składkowe, anulowanie linkiem, ukryte
- [x] Rezerwacje odporne na wyścigi (SERIALIZABLE + ponowienia, test 6 równoległych prób)
- [x] Dashboard: RSVP, obecność per część, menu, dzieci per próg, logistyka, prezenty
- [x] Eksport Excel: Start = goście; Standard/Premium = podsumowanie, goście, menu dla sali, dzieci, prezenty
- [x] Zgody RODO (rejestr z wersją treści i skrótem IP), szkic polityki prywatności i regulaminu
- [x] Limity pakietów egzekwowane na serwerze (goście z miejscami na +1, prezenty, zespół, prezenty składkowe)
- [x] Testy integracyjne na prawdziwej bazie (27) + testy logiki (15)
- [ ] Przegląd UI w przeglądarce (desktop + telefon)
- [ ] Treść polityki prywatności i regulaminu do weryfikacji prawnej

### Faza 2: Planowanie
- [ ] Szablony zadań PL/EN per typ ceremonii, generowanie, przeliczanie dat
- [ ] Zadania: własne, przypisanie osoby, statusy, filtry, kategorie
- [ ] Kalendarz (zadania, płatności, spotkania, części wydarzenia)
- [ ] Budżet: kategorie, wydatki, płatności/zaliczki, szacunek cateringu (goście × cena, progi dzieci)
- [ ] Usługodawcy: kontakty, statusy, umowy (upload PDF)
- [ ] Eksport: zadania, budżet, usługodawcy

### Faza 3: Goście+
- [ ] Import gości z XLSX/CSV (szablon do pobrania, podgląd, mapowanie kolumn, walidacja)
- [ ] Termin RSVP + przypomnienia mailowe (pg-boss), masowa wysyłka zaproszeń mailem
- [ ] Nocleg i transport: raporty dla hotelu/przewoźnika
- [ ] Plan stołów (dnd-kit), konflikty (np. brak miejsca), eksport PDF + Excel
- [ ] Odblokowanie RSVP przez parę, historia zmian (AuditLog)
- [ ] Strona wydarzenia: harmonogram, FAQ, dress code, galeria, hasło, motywy graficzne

### Faza 4: Po weselu + RODO
- [ ] Lista podziękowań (gospodarstwo → prezent → wysłano)
- [ ] Link do albumu zdjęć na stronie wydarzenia
- [ ] Retencja: anonimizacja danych gości X miesięcy po weselu (job), eksport danych pary, usunięcie konta
- [ ] Rejestr zgód, żądanie usunięcia danych przez gościa

### Faza 5: SaaS
- [ ] Landing page (PL/EN), cennik
- [ ] Płatności Stripe (BLIK/P24/karta), limity planu FREE vs PREMIUM
- [ ] Panel superadmina: wesela, użytkownicy, płatności, nadużycia
- [ ] Faktury (Stripe Invoicing lub integracja z Fakturownią/inFaktem)
- [ ] Monitoring, backupy Postgresa i plików S3 (Dokploy + zewnętrzny S3), alerty

### Backlog
- [ ] **Plan dla wedding plannerów (B2B)**: jedno konto, wiele wesel, branding konsultanta, rozliczenie per wesele lub subskrypcja. Model `WeddingMember` już to wspiera (użytkownik może być członkiem wielu wesel).
- [ ] Subdomeny `slug.domena.pl` i własne domeny par (Premium)
- [ ] Dwustronna synchronizacja z Google Calendar
- [ ] SMS-y (przypomnienia RSVP)

## 10. Bezpieczeństwo i RODO

- Tokeny gospodarstw: 128-bit losowe (base62, ~22 znaki), nie ID. Rotacja przez parę.
- Publiczne endpointy: rate limit (Turnstile w fazie 3), brak enumeracji (jednakowe odpowiedzi).
- Para jest **administratorem** danych gości, SaaS jest **podmiotem przetwarzającym**: potrzebna umowa powierzenia (DPA) w regulaminie.
- Minimalizacja: data urodzenia dziecka tylko jeśli potrzebna (alternatywnie wiek lub przedział).
- Dane o diecie/alergiach mogą ujawniać dane o zdrowiu: wyraźna zgoda, retencja.
- Backupy szyfrowane, poza VPS.

## 11. Otwarte pytania

1. **Nazwa produktu i domena**: potrzebne do deployu na Dokploy, maili (MAIL_FROM) i landing page.
2. **Faktury**: działalność gospodarcza (VAT?) → Stripe Invoicing czy Fakturownia/inFakt?
3. **Ceny pakietów**: 0 / 149 / 249 zł to propozycja; do weryfikacji z konkurencją.
