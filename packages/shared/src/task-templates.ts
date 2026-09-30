import type { CeremonyType } from "./schemas/wedding";

export const TASK_CATEGORIES = [
  "PLANNING",
  "FORMALITIES",
  "CEREMONY",
  "VENUE",
  "VENDORS",
  "ATTIRE",
  "GUESTS",
  "DECOR",
  "AFTER",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

type Text = { pl: string; en: string };

export interface TaskTemplate {
  /** Stały klucz: pozwala dogenerować nowe zadania bez duplikatów. Nie zmieniać po publikacji. */
  key: string;
  category: TaskCategory;
  /** Dni względem daty ślubu (ujemne = przed). */
  offsetDays: number;
  /** Brak = wszystkie rodzaje ceremonii. */
  ceremonyTypes?: CeremonyType[];
  title: Text;
  description?: Text;
}

const RECEPTION: CeremonyType[] = ["CHURCH", "CIVIL_RECEPTION_ONLY"];
const CIVIL: CeremonyType[] = ["CIVIL", "CIVIL_RECEPTION_ONLY"];
const CHURCH: CeremonyType[] = ["CHURCH"];

/**
 * Standardowa lista zadań młodej pary. Opisy formalności są orientacyjne:
 * wymagania różnią się między urzędami i diecezjami, dlatego opisy zachęcają do sprawdzenia na miejscu.
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  // ─── Planowanie ───
  {
    key: "set_budget",
    category: "PLANNING",
    offsetDays: -365,
    title: { pl: "Ustalcie budżet wesela", en: "Set the wedding budget" },
    description: {
      pl: "Ustalcie, ile chcecie wydać i kto się dokłada. Rozpiszcie kwoty na kategorie w zakładce Budżet.",
      en: "Decide how much you want to spend and who contributes. Split it into categories in the Budget tab.",
    },
  },
  {
    key: "guest_list_draft",
    category: "GUESTS",
    offsetDays: -350,
    title: { pl: "Przygotujcie wstępną listę gości", en: "Draft the guest list" },
    description: {
      pl: "Liczba gości decyduje o wyborze sali i budżecie. Dodajcie gości w zakładce Goście.",
      en: "The number of guests drives the venue choice and budget. Add them in the Guests tab.",
    },
  },
  { key: "witnesses", category: "FORMALITIES", offsetDays: -300, title: { pl: "Wybierzcie świadków", en: "Choose your witnesses" } },
  { key: "honeymoon", category: "PLANNING", offsetDays: -180, title: { pl: "Zaplanujcie podróż poślubną", en: "Plan the honeymoon" } },
  {
    key: "first_dance",
    category: "PLANNING",
    offsetDays: -120,
    ceremonyTypes: RECEPTION,
    title: { pl: "Kurs tańca na pierwszy taniec", en: "First dance lessons" },
  },
  {
    key: "day_schedule",
    category: "PLANNING",
    offsetDays: -30,
    title: { pl: "Przygotujcie harmonogram dnia ślubu", en: "Prepare the wedding day schedule" },
    description: {
      pl: "Godziny przygotowań, zdjęć, ceremonii i atrakcji. Uzupełnijcie też plan dnia na stronie gości.",
      en: "Times for getting ready, photos, the ceremony and entertainment. Update the schedule on the guest page too.",
    },
  },
  {
    key: "final_payments",
    category: "PLANNING",
    offsetDays: -7,
    title: { pl: "Rozliczcie ostatnie płatności u usługodawców", en: "Settle final payments with vendors" },
  },
  {
    key: "emergency_kit",
    category: "PLANNING",
    offsetDays: -3,
    title: { pl: "Spakujcie zestaw awaryjny na dzień ślubu", en: "Pack a wedding day emergency kit" },
    description: {
      pl: "Igła i nitka, plastry, leki przeciwbólowe, ładowarka, zapasowe rajstopy, chusteczki.",
      en: "Needle and thread, plasters, painkillers, a charger, spare tights, tissues.",
    },
  },

  // ─── Formalności: ślub cywilny ───
  {
    key: "usc_book_date",
    category: "FORMALITIES",
    offsetDays: -300,
    ceremonyTypes: CIVIL,
    title: { pl: "Zarezerwujcie termin w urzędzie stanu cywilnego", en: "Book a date at the registry office" },
    description: {
      pl: "W popularnych urzędach terminy weekendowe znikają szybko. Zapytajcie o ślub poza urzędem, jeśli go planujecie.",
      en: "Weekend dates at popular offices go quickly. Ask about an outdoor ceremony if you plan one.",
    },
  },
  {
    key: "usc_declaration",
    category: "FORMALITIES",
    offsetDays: -60,
    ceremonyTypes: CIVIL,
    title: { pl: "Złóżcie w USC zapewnienie o braku przeszkód do małżeństwa", en: "Submit the no-impediment declaration at the registry office" },
    description: {
      pl: "Zapewnienie składa się osobiście, zwykle co najmniej miesiąc przed ślubem, i jest ważne 6 miesięcy. Weźcie dowody osobiste; wymagania potwierdźcie w swoim urzędzie.",
      en: "Submitted in person, usually at least a month before the wedding, and valid for 6 months. Bring ID; confirm requirements with your office.",
    },
  },
  {
    key: "usc_witnesses_docs",
    category: "FORMALITIES",
    offsetDays: -7,
    ceremonyTypes: CIVIL,
    title: { pl: "Przypomnijcie świadkom o dowodach osobistych", en: "Remind witnesses to bring their ID" },
  },

  // ─── Formalności: ślub kościelny (konkordatowy) ───
  {
    key: "parish_book_date",
    category: "FORMALITIES",
    offsetDays: -330,
    ceremonyTypes: CHURCH,
    title: { pl: "Zarezerwujcie termin w parafii", en: "Book a date at the parish" },
  },
  {
    key: "marriage_course",
    category: "FORMALITIES",
    offsetDays: -240,
    ceremonyTypes: CHURCH,
    title: { pl: "Ukończcie kurs przedmałżeński", en: "Complete the marriage preparation course" },
    description: {
      pl: "Kurs trwa zwykle kilka tygodni lub jeden intensywny weekend. Zaświadczenie będzie potrzebne do protokołu.",
      en: "Usually several weeks or one intensive weekend. You'll need the certificate for the parish protocol.",
    },
  },
  {
    key: "family_counseling",
    category: "FORMALITIES",
    offsetDays: -150,
    ceremonyTypes: CHURCH,
    title: { pl: "Spotkania w poradni życia rodzinnego", en: "Family counselling sessions" },
  },
  {
    key: "baptism_certs",
    category: "FORMALITIES",
    offsetDays: -100,
    ceremonyTypes: CHURCH,
    title: { pl: "Zdobądźcie aktualne świadectwa chrztu", en: "Get recent baptism certificates" },
    description: {
      pl: "Wydaje je parafia chrztu, zwykle z adnotacją o bierzmowaniu. Parafie wymagają świadectw wydanych niedawno (często do 3–6 miesięcy); zapytajcie w swojej.",
      en: "Issued by your baptism parish, usually noting confirmation. Parishes require recent certificates (often up to 3–6 months old); check with yours.",
    },
  },
  {
    key: "usc_certificate",
    category: "FORMALITIES",
    offsetDays: -100,
    ceremonyTypes: CHURCH,
    title: { pl: "Uzyskajcie w USC zaświadczenie do ślubu konkordatowego", en: "Get the registry office certificate for a concordat wedding" },
    description: {
      pl: "Zaświadczenie o braku okoliczności wyłączających zawarcie małżeństwa jest ważne 6 miesięcy. Zanieście je do parafii.",
      en: "The certificate of no impediment is valid for 6 months. Take it to the parish.",
    },
  },
  {
    key: "parish_protocol",
    category: "FORMALITIES",
    offsetDays: -90,
    ceremonyTypes: CHURCH,
    title: { pl: "Spiszcie protokół przedmałżeński w parafii", en: "Complete the pre-marriage protocol at the parish" },
    description: {
      pl: "Zabierzcie dowody osobiste, świadectwa chrztu, zaświadczenie z USC i zaświadczenie z kursu.",
      en: "Bring ID, baptism certificates, the registry office certificate and the course certificate.",
    },
  },
  {
    key: "banns",
    category: "FORMALITIES",
    offsetDays: -60,
    ceremonyTypes: CHURCH,
    title: { pl: "Zapowiedzi w parafiach", en: "Marriage banns in your parishes" },
    description: {
      pl: "Ogłaszane w parafiach narzeczonych przez kolejne niedziele. Kartkę z potwierdzeniem zanieście do parafii ślubu.",
      en: "Announced in both parishes on consecutive Sundays. Bring the confirmation back to the wedding parish.",
    },
  },
  {
    key: "license_other_parish",
    category: "FORMALITIES",
    offsetDays: -45,
    ceremonyTypes: CHURCH,
    title: { pl: "Licencja, jeśli ślub odbywa się w innej parafii", en: "Licence if marrying in a different parish" },
  },
  {
    key: "ceremony_music",
    category: "CEREMONY",
    offsetDays: -90,
    ceremonyTypes: CHURCH,
    title: { pl: "Oprawa muzyczna ceremonii", en: "Ceremony music" },
  },
  {
    key: "readings",
    category: "CEREMONY",
    offsetDays: -30,
    ceremonyTypes: CHURCH,
    title: { pl: "Wybierzcie czytania i osoby czytające", en: "Choose readings and readers" },
  },
  {
    key: "confession",
    category: "CEREMONY",
    offsetDays: -3,
    ceremonyTypes: CHURCH,
    title: { pl: "Spowiedź przedślubna", en: "Pre-wedding confession" },
  },

  // ─── Sala i przyjęcie ───
  {
    key: "book_venue",
    category: "VENUE",
    offsetDays: -350,
    ceremonyTypes: RECEPTION,
    title: { pl: "Zarezerwujcie salę weselną", en: "Book the reception venue" },
    description: {
      pl: "Najpopularniejsze sale rezerwuje się z ponad rocznym wyprzedzeniem. Sprawdźcie, co obejmuje cena talerzyka i jakie są stawki za dzieci.",
      en: "Popular venues book up more than a year ahead. Check what the per-plate price includes and the rates for children.",
    },
  },
  {
    key: "book_dinner",
    category: "VENUE",
    offsetDays: -180,
    ceremonyTypes: ["CIVIL"],
    title: { pl: "Zarezerwujcie restaurację na obiad weselny", en: "Book a restaurant for the wedding meal" },
  },
  {
    key: "menu_tasting",
    category: "VENUE",
    offsetDays: -90,
    ceremonyTypes: RECEPTION,
    title: { pl: "Degustacja i wybór menu", en: "Menu tasting and selection" },
  },
  { key: "cake", category: "VENUE", offsetDays: -90, ceremonyTypes: RECEPTION, title: { pl: "Zamówcie tort", en: "Order the cake" } },
  {
    key: "drinks",
    category: "VENUE",
    offsetDays: -60,
    ceremonyTypes: RECEPTION,
    title: { pl: "Zaplanujcie alkohol i napoje", en: "Plan alcohol and drinks" },
  },
  {
    key: "seating_plan",
    category: "GUESTS",
    offsetDays: -14,
    ceremonyTypes: RECEPTION,
    title: { pl: "Przygotujcie plan stołów", en: "Prepare the seating plan" },
  },
  {
    key: "final_headcount",
    category: "VENUE",
    offsetDays: -10,
    title: { pl: "Przekażcie ostateczną liczbę gości i wybory menu", en: "Send the final headcount and meal choices" },
    description: {
      pl: "Wyeksportujcie arkusz Excel z aplikacji: zakładka „Menu” zawiera liczby dań i listę alergii.",
      en: "Export the Excel workbook from the app: the “Menu” sheet has meal counts and allergies.",
    },
  },

  // ─── Usługodawcy ───
  {
    key: "book_photographer",
    category: "VENDORS",
    offsetDays: -330,
    title: { pl: "Zarezerwujcie fotografa", en: "Book a photographer" },
  },
  {
    key: "book_videographer",
    category: "VENDORS",
    offsetDays: -300,
    title: { pl: "Zarezerwujcie kamerzystę", en: "Book a videographer" },
  },
  {
    key: "book_band",
    category: "VENDORS",
    offsetDays: -300,
    ceremonyTypes: RECEPTION,
    title: { pl: "Zarezerwujcie zespół lub DJ-a", en: "Book a band or DJ" },
  },
  {
    key: "florist",
    category: "DECOR",
    offsetDays: -180,
    title: { pl: "Wybierzcie florystę i dekoracje", en: "Choose a florist and decorations" },
  },
  {
    key: "hair_makeup",
    category: "VENDORS",
    offsetDays: -150,
    title: { pl: "Zarezerwujcie fryzjera i makijażystkę", en: "Book hair and make-up artists" },
  },
  {
    key: "wedding_car",
    category: "VENDORS",
    offsetDays: -120,
    title: { pl: "Zarezerwujcie auto do ślubu", en: "Book the wedding car" },
  },
  {
    key: "hair_makeup_trial",
    category: "VENDORS",
    offsetDays: -45,
    title: { pl: "Próbna fryzura i makijaż", en: "Hair and make-up trial" },
  },

  // ─── Stroje ───
  {
    key: "dress",
    category: "ATTIRE",
    offsetDays: -270,
    title: { pl: "Wybierzcie suknię ślubną", en: "Choose the wedding dress" },
    description: {
      pl: "Szycie i poprawki trwają zwykle kilka miesięcy.",
      en: "Making and alterations usually take several months.",
    },
  },
  { key: "suit", category: "ATTIRE", offsetDays: -150, title: { pl: "Wybierzcie garnitur", en: "Choose the suit" } },
  {
    key: "rings",
    category: "ATTIRE",
    offsetDays: -120,
    title: { pl: "Kupcie obrączki", en: "Buy the wedding rings" },
    description: { pl: "Wykonanie i grawer trwają zwykle kilka tygodni.", en: "Making and engraving usually take a few weeks." },
  },
  { key: "shoes_accessories", category: "ATTIRE", offsetDays: -90, title: { pl: "Buty i dodatki", en: "Shoes and accessories" } },
  {
    key: "pickup_attire",
    category: "ATTIRE",
    offsetDays: -7,
    title: { pl: "Odbierzcie suknię i garnitur", en: "Pick up the dress and suit" },
  },

  // ─── Goście ───
  {
    key: "guest_accommodation",
    category: "GUESTS",
    offsetDays: -180,
    ceremonyTypes: RECEPTION,
    title: { pl: "Zarezerwujcie noclegi dla gości", en: "Book accommodation for guests" },
    description: {
      pl: "Goście zaznaczają potrzebę noclegu w formularzu RSVP; liczby zobaczycie w Przeglądzie.",
      en: "Guests mark accommodation needs in the RSVP form; see the numbers in Overview.",
    },
  },
  {
    key: "guest_transport",
    category: "GUESTS",
    offsetDays: -120,
    ceremonyTypes: RECEPTION,
    title: { pl: "Zorganizujcie transport dla gości", en: "Arrange guest transport" },
  },
  {
    key: "invitations",
    category: "GUESTS",
    offsetDays: -150,
    title: { pl: "Zamówcie zaproszenia", en: "Order invitations" },
    description: {
      pl: "Wydrukujcie na nich kod QR z zakładki Goście: gość potwierdzi obecność jednym skanem.",
      en: "Print the QR code from the Guests tab on them: guests RSVP with one scan.",
    },
  },
  {
    key: "gift_list",
    category: "GUESTS",
    offsetDays: -100,
    title: { pl: "Uzupełnijcie listę prezentów", en: "Fill in the gift list" },
  },
  {
    key: "send_invitations",
    category: "GUESTS",
    offsetDays: -90,
    title: { pl: "Wyślijcie zaproszenia", en: "Send the invitations" },
  },
  {
    key: "rsvp_followup",
    category: "GUESTS",
    offsetDays: -35,
    title: { pl: "Przypomnijcie się gościom bez odpowiedzi", en: "Follow up with guests who haven't replied" },
  },
  {
    key: "thank_you_gifts",
    category: "DECOR",
    offsetDays: -45,
    title: { pl: "Przygotujcie podziękowania dla gości i rodziców", en: "Prepare thank-you gifts for guests and parents" },
  },

  // ─── Po ślubie ───
  {
    key: "marriage_certs",
    category: "AFTER",
    offsetDays: 14,
    title: { pl: "Odbierzcie odpisy aktu małżeństwa", en: "Collect marriage certificate copies" },
  },
  {
    key: "id_change",
    category: "AFTER",
    offsetDays: 21,
    title: { pl: "Wymieńcie dokumenty po zmianie nazwiska", en: "Update ID documents after a name change" },
    description: {
      pl: "Dowód osobisty, paszport, prawo jazdy. Zróbcie to niezwłocznie: dowód z nieaktualnymi danymi po pewnym czasie traci ważność.",
      en: "ID card, passport, driving licence. Do it promptly: an ID card with outdated data expires after a while.",
    },
  },
  {
    key: "update_records",
    category: "AFTER",
    offsetDays: 30,
    title: { pl: "Zaktualizujcie dane w banku, pracy i urzędach", en: "Update your details with the bank, employer and offices" },
  },
  {
    key: "thank_you_notes",
    category: "AFTER",
    offsetDays: 30,
    title: { pl: "Wyślijcie podziękowania za prezenty", en: "Send thank-you notes for gifts" },
  },
  {
    key: "photos_pickup",
    category: "AFTER",
    offsetDays: 60,
    title: { pl: "Odbierzcie zdjęcia i film", en: "Collect photos and video" },
  },
];

export function templatesFor(ceremonyType: CeremonyType): TaskTemplate[] {
  return TASK_TEMPLATES.filter((t) => !t.ceremonyTypes || t.ceremonyTypes.includes(ceremonyType));
}

/** Data ślubu (YYYY-MM-DD) + przesunięcie → YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
