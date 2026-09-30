import { Router } from "express";
import { notFound } from "../../lib/http";
import { readObject } from "../../lib/storage";

/** Zdjęcia z S3/MinIO serwowane przez aplikację (bucket nie musi być publiczny, CSP: 'self'). */
export const mediaRouter = Router();

const KEY = /^weddings\/[a-z0-9]+\/gifts\/[A-Za-z0-9]+\.webp$/;

mediaRouter.get("/{*key}", async (req, res) => {
  const key = (req.params as { key?: string[] }).key?.join("/") ?? "";
  if (!KEY.test(key)) throw notFound();
  let obj;
  try {
    obj = await readObject(key);
  } catch {
    throw notFound();
  }
  // Klucze są unikalne (nowe zdjęcie = nowy klucz), więc można cache'ować na zawsze.
  res.set({ "Content-Type": obj.contentType, "Cache-Control": "public, max-age=31536000, immutable" });
  if (obj.length) res.set("Content-Length", String(obj.length));
  obj.body.pipe(res);
});
