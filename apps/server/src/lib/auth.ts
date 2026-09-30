import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "../env";
import { prisma } from "./db";
import { t } from "./i18n";
import { sendActionMail } from "./mail";

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [env.APP_URL],
  user: {
    additionalFields: {
      locale: { type: "string", defaultValue: "pl", input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const locale = (user as { locale?: string }).locale;
      await sendActionMail({
        to: user.email,
        locale,
        subject: t(locale, "mail.reset.subject"),
        body: t(locale, "mail.reset.body"),
        cta: t(locale, "mail.reset.cta"),
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const locale = (user as { locale?: string }).locale;
      await sendActionMail({
        to: user.email,
        locale,
        subject: t(locale, "mail.verify.subject"),
        body: t(locale, "mail.verify.body", { name: user.name }),
        cta: t(locale, "mail.verify.cta"),
        url,
      });
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {},
});
