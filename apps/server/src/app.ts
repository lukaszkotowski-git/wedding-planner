import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./env";
import { auth } from "./lib/auth";
import { logger } from "./lib/logger";
import { limiter } from "./lib/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { mediaRouter } from "./modules/media/routes";
import { publicRouter } from "./modules/public/routes";
import { invitationsRouter } from "./modules/team/routes";
import { weddingsRouter } from "./modules/weddings/routes";
import { mountSpa } from "./spa";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // za reverse proxy Dokploy (Traefik)
  app.disable("x-powered-by");

  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Better Auth musi dostać surowe body, więc montujemy go przed express.json().
  app.all("/api/auth/{*any}", limiter(30), toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use("/api/public", limiter(60), publicRouter);
  app.use("/api/weddings", limiter(300), weddingsRouter);
  app.use("/api/invitations", limiter(30), invitationsRouter);
  app.use("/api", notFoundHandler);
  app.use("/media", mediaRouter);

  if (env.NODE_ENV === "production") {
    const here = path.dirname(fileURLToPath(import.meta.url));
    mountSpa(app, path.resolve(here, "../../web/dist"), env.APP_URL);
  }

  app.use(errorHandler);
  return app;
}
