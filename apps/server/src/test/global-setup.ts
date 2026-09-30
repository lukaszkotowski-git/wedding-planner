import { execSync } from "node:child_process";
import path from "node:path";
import { TEST_DATABASE_URL } from "../../vitest.config";

/** Świeża baza testowa przy każdym uruchomieniu (tworzona, jeśli nie istnieje). */
export default function setup() {
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: path.resolve(import.meta.dirname, "../.."),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
