import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not_found" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation_error", issues: z.flattenError(err).fieldErrors });
    return;
  }
  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
};
