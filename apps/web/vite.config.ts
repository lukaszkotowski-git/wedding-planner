import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /media też przez proxy: zdjęcia prezentów serwuje API.
const api = process.env.API_URL ?? "http://localhost:3000";
const proxy = { "/api": api, "/media": api };

export default defineConfig({
  plugins: [react()],
  // Osobny cache dla równoległego serwera testów e2e (współdzielony cache blokował optymalizator).
  cacheDir: process.env.VITE_CACHE_DIR ?? "node_modules/.vite",
  optimizeDeps: {
    // Zależności używane tylko w leniwie ładowanej części (panel, logowanie). Bez tej listy Vite odkrywa je
    // dopiero w trakcie ładowania strony i żądania modułów potrafią zawisnąć do czasu przeładowania.
    include: [
      "better-auth/react",
      "better-auth/client/plugins",
      "zod",
      "react-hook-form",
      "@hookform/resolvers/zod",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "sonner",
      "lucide-react",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: { port: Number(process.env.WEB_PORT ?? 5173), strictPort: true, proxy },
  // `vite preview` (build produkcyjny) używany przez testy e2e: ten sam proxy do API.
  preview: { port: Number(process.env.WEB_PORT ?? 4173), strictPort: true, proxy },
});
