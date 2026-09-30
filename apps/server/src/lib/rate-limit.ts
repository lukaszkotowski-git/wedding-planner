import rateLimit from "express-rate-limit";
import { env } from "../env";

/** Limit żądań na IP na minutę. W testach wyłączony (wszystkie żądania z jednego IP). */
export const limiter = (limit: number) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
  });
