import { execSync } from "node:child_process";
import path from "node:path";
import { E2E_DB } from "./playwright.config";

/** Migracje na bazie e2e (tworzona przy pierwszym uruchomieniu). Bez resetu: testy tworzą unikalne dane. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(import.meta.dirname, "../apps/server"),
    env: { ...process.env, DATABASE_URL: E2E_DB },
    stdio: "pipe",
  });
}
