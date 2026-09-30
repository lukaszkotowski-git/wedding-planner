// Uruchamia Playwrighta natywnie na Apple Silicon, nawet gdy terminal działa pod Rosettą (x86_64).
// Chrome pod Rosettą wykonuje nowy kod JS kilkadziesiąt razy wolniej i testy przekraczają limity czasu.
import { execSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
let translated = false;
if (process.platform === "darwin") {
  try {
    translated = execSync("sysctl -n sysctl.proc_translated", { encoding: "utf8" }).trim() === "1";
  } catch {}
}
const cmd = translated ? ["arch", ["-arm64", "npx", "playwright", "test", ...args]] : ["npx", ["playwright", "test", ...args]];
const { status } = spawnSync(cmd[0], cmd[1], { stdio: "inherit" });
process.exit(status ?? 1);
