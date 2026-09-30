import { useTranslation } from "react-i18next";

/**
 * Szkic dokumentów prawnych. Przed publicznym startem treść musi zweryfikować prawnik
 * (para = administrator danych gości, serwis = podmiot przetwarzający, umowa powierzenia).
 */
const CONTENT = {
  pl: {
    privacy: [
      ["Kto przetwarza dane", "Administratorem danych gości (imię, nazwisko, e-mail, odpowiedź na zaproszenie, wybór menu, informacje o diecie) jest para młoda, która zaprosiła gościa. Serwis Wedding Planner przetwarza te dane w imieniu pary jako podmiot przetwarzający."],
      ["Cel i podstawa", "Dane są przetwarzane w celu organizacji wesela: potwierdzenia obecności, przygotowania menu, rezerwacji prezentów i kontaktu z gośćmi. Podstawą jest zgoda wyrażona w formularzu (art. 6 ust. 1 lit. a oraz art. 9 ust. 2 lit. a RODO dla informacji o diecie)."],
      ["Jak długo", "Dane gości są usuwane lub anonimizowane po zakończeniu okresu przechowywania zależnego od pakietu pary (od 3 do 24 miesięcy po dacie ślubu)."],
      ["Twoje prawa", "Masz prawo dostępu do danych, ich poprawienia, usunięcia, ograniczenia przetwarzania i cofnięcia zgody w dowolnym momencie. Skontaktuj się z parą młodą lub z nami."],
      ["Pliki cookies", "Używamy wyłącznie niezbędnych plików cookies do logowania oraz zapamiętania języka i motywu."],
    ],
    terms: [
      ["Usługa", "Wedding Planner to narzędzie do planowania wesela: lista gości, potwierdzanie obecności, lista prezentów i eksport danych."],
      ["Konto", "Konto zakłada osoba pełnoletnia. Użytkownik odpowiada za treści i dane gości wprowadzone do serwisu."],
      ["Płatności", "Pakiety płatne są opłacane jednorazowo za wesele i obowiązują do 12 miesięcy po dacie ślubu."],
      ["Odpowiedzialność", "Serwis nie pośredniczy w zakupie prezentów ani w przekazywaniu pieniędzy."],
    ],
  },
  en: {
    privacy: [
      ["Who processes data", "The controller of guest data (name, email, RSVP, meal choice, dietary information) is the couple who invited the guest. Wedding Planner processes this data on the couple's behalf as a processor."],
      ["Purpose and legal basis", "Data is processed to organise the wedding: RSVPs, menu planning, gift reservations and contacting guests. The legal basis is the consent given in the form (Art. 6(1)(a) and, for dietary information, Art. 9(2)(a) GDPR)."],
      ["Retention", "Guest data is deleted or anonymised after the retention period of the couple's plan (3 to 24 months after the wedding date)."],
      ["Your rights", "You may access, correct or delete your data, restrict processing and withdraw consent at any time. Contact the couple or us."],
      ["Cookies", "We only use cookies necessary for login and remembering your language and theme."],
    ],
    terms: [
      ["Service", "Wedding Planner is a wedding planning tool: guest list, RSVPs, gift list and data export."],
      ["Account", "Accounts may be created by adults only. Users are responsible for content and guest data they enter."],
      ["Payments", "Paid plans are a one-time payment per wedding, valid until 12 months after the wedding date."],
      ["Liability", "The service does not act as an intermediary for buying gifts or transferring money."],
    ],
  },
} as const;

export function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { t, i18n } = useTranslation();
  const sections = CONTENT[i18n.resolvedLanguage === "en" ? "en" : "pl"][doc];
  return (
    <article className="container max-w-2xl space-y-6 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t(`legal.${doc}`)}</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        {t("legal.draft")}
      </p>
      {sections.map(([title, body]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="leading-relaxed text-muted-foreground">{body}</p>
        </section>
      ))}
    </article>
  );
}
