import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  // Nigdy nie logujemy sesji ani tokenów.
  redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
