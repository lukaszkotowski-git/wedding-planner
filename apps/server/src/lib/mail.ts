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

interface ActionMail {
  to: string;
  locale: string | null | undefined;
  subject: string;
  body: string;
  cta: string;
  url: string;
}

/** Prosty mail z jednym przyciskiem. Szablony HTML rozbudujemy w fazie 3. */
export async function sendActionMail({ to, locale, subject, body, cta, url }: ActionMail) {
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1c1917;max-width:520px;margin:0 auto;padding:24px">
<p>${escapeHtml(body)}</p>
<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#1c1917;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(cta)}</a></p>
<p style="font-size:12px;color:#78716c">${escapeHtml(t(locale, "mail.footer"))}</p>
</body></html>`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    text: `${body}\n\n${cta}: ${url}\n\n${t(locale, "mail.footer")}`,
  });
  logger.info({ to, subject }, "mail sent");
}
