import { z } from "zod";

/** Pusty string z formularza → null. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.url({ protocol: /^https?$/ }).nullable());

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.email().nullable());

/** Kwota w złotych z formularza → grosze. */
export const moneyCents = z.coerce.number().min(0).max(10_000_000).transform((v) => Math.round(v * 100));
