import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  // Pakiety workspace to źródła TS: wbudowujemy je w bundle.
  noExternal: [/^@wedding\//],
});
