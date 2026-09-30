import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Mac z Apple Silicon, na którym node_modules zainstalowano z terminala pod Rosettą (x86_64):
 * Playwright i Chrome powinny działać natywnie (arm64 — pod Rosettą Chrome jest kilkadziesiąt razy wolniejszy),
 * ale serwery aplikacji muszą zostać x86_64, bo takie są natywne moduły (Prisma, esbuild, sharp).
 */
const x86Prefix =
  process.platform === "darwin" && process.arch === "arm64" && !existsSync(new URL("../node_modules/@esbuild/darwin-arm64", import.meta.url))
    ? "arch -x86_64 "
    : "";

/** Osobna baza i porty: testy e2e nie dotykają danych deweloperskich. */
export const E2E_DB = "postgresql://wedding:wedding@localhost:5442/wedding_e2e";
const API_PORT = 3300;
const WEB_PORT = 5300;
export const BASE_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    locale: "pl-PL",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: `${x86Prefix}npx tsx --env-file=../../.env src/index.ts`,
      cwd: "../apps/server",
      port: API_PORT,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "test", // wyłącza limity żądań (wszystkie testy z jednego IP)
        PORT: String(API_PORT),
        APP_URL: BASE_URL,
        DATABASE_URL: E2E_DB,
        S3_BUCKET: "wedding-e2e",
      },
    },
    {
      // Build produkcyjny zamiast serwera deweloperskiego: bez przeładowań optymalizatora zależności Vite.
      command: `${x86Prefix}npx vite build --logLevel warn && ${x86Prefix}npx vite preview`,
      cwd: "../apps/web",
      port: WEB_PORT,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WEB_PORT: String(WEB_PORT), API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
