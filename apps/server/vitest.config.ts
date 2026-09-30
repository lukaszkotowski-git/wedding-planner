import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL = "postgresql://wedding:wedding@localhost:5442/wedding_test";

export default defineConfig({
  test: {
    globalSetup: ["./src/test/global-setup.ts"],
    // Testy integracyjne dzielą jedną bazę.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:5173",
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1035",
      MAIL_FROM: "test@example.com",
      S3_ENDPOINT: "http://localhost:9010",
      S3_BUCKET: "wedding-test",
      S3_ACCESS_KEY: "dev",
      S3_SECRET_KEY: "dev-secret",
    },
  },
});
