import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { escapeHtml } from "./lib/mail";
import { findPublicWedding } from "./modules/public/routes";

export const OG_PLACEHOLDER = "<!--app-head-->";

export interface OgMeta {
  title: string;
  description: string;
  url: string;
}

export function injectOg(html: string, meta: OgMeta): string {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}">`,
  ].join("\n    ");
  return html.replace(/<title>.*?<\/title>/s, "").replace(OG_PLACEHOLDER, tags);
}

/**
 * Serwuje zbudowanego klienta. Każda nie-API ścieżka dostaje index.html (routing po stronie klienta),
 * a /w/:slug dodatkowo meta OG, żeby linki w komunikatorach miały podgląd.
 */
export function mountSpa(app: Express, distDir: string, appUrl: string) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) return;
  const template = fs.readFileSync(indexPath, "utf8");

  app.use(express.static(distDir, { index: false, maxAge: "1y", immutable: true }));

  app.get("/w/:slug{/*rest}", async (req, res) => {
    const w = await findPublicWedding(req.params.slug);
    const html = w
      ? injectOg(template, {
          title: `${w.partnerOneName} & ${w.partnerTwoName}`,
          description: new Intl.DateTimeFormat(w.locale, { dateStyle: "long" }).format(w.date),
          url: `${appUrl}/w/${w.slug}`,
        })
      : template;
    res.set("Cache-Control", "no-cache").type("html").send(html);
  });

  app.get("/{*path}", (_req, res) => {
    res.set("Cache-Control", "no-cache").type("html").send(template);
  });
}
