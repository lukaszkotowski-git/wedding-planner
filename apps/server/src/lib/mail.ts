import nodemailer from "nodemailer";
import { env } from "../env";
import { t } from "./i18n";
import { logger } from "./logger";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export interface ActionMail {
  to: string;
  locale: string | null | undefined;
  subject: string;
  body: string;
  /** Dodatkowe linie (np. podsumowanie RSVP). */
  lines?: string[];
  cta?: string;
  url?: string;
}

/** Prosty mail z opcjonalnym przyciskiem. Szablony HTML rozbudujemy w fazie 3. */
export async function sendActionMail({ to, locale, subject, body, lines = [], cta, url }: ActionMail) {
  const list = lines.length
    ? `<ul style="padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
  const button =
    cta && url
      ? `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#1c1917;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(cta)}</a></p>`
      : "";
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1c1917;max-width:520px;margin:0 auto;padding:24px">
<p>${escapeHtml(body)}</p>${list}${button}
<p style="font-size:12px;color:#78716c">${escapeHtml(t(locale, "mail.footer"))}</p>
</body></html>`;
  const text = [body, ...lines.map((l) => `- ${l}`), cta && url ? `\n${cta}: ${url}` : "", `\n${t(locale, "mail.footer")}`]
    .filter(Boolean)
    .join("\n");
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
  logger.info({ subject }, "mail sent");
}

/** Wysyłka, której błąd nie powinien wycofać już zapisanej operacji (np. RSVP). */
export function sendMailInBackground(mail: ActionMail) {
  sendActionMail(mail).catch((err) => logger.error({ err, subject: mail.subject }, "mail failed"));
}
