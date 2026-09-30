import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:5173",
      DATABASE_URL: "postgresql://wedding:wedding@localhost:5442/wedding",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1035",
      MAIL_FROM: "test@example.com",
    },
  },
});
