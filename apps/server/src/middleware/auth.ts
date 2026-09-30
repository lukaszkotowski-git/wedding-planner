import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { hasRole, type WeddingRole } from "@wedding/shared";
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";
import { forbidden, notFound, unauthorized } from "../lib/http";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw unauthorized();
  const u = session.user as typeof session.user & { locale?: string };
  req.user = { id: u.id, email: u.email, name: u.name, locale: u.locale ?? "pl" };
  next();
};

/**
 * Ładuje wesele z `:weddingId` i sprawdza członkostwo użytkownika.
 * Jedyna droga dostępu do danych wesela w panelu. Handlery używają `req.wedding!.id`.
 * Brak członkostwa → 404 (nie zdradzamy istnienia cudzego wesela).
 */
export function requireWeddingRole(minRole: WeddingRole): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) throw unauthorized();
    const weddingId = req.params.weddingId;
    if (typeof weddingId !== "string") throw notFound();
    const member = await prisma.weddingMember.findUnique({
      where: { weddingId_userId: { weddingId, userId: req.user.id } },
      include: { wedding: true },
    });
    if (!member || member.wedding.deletedAt) throw notFound();
    if (!hasRole(member.role, minRole)) throw forbidden();
    req.wedding = member.wedding;
    req.weddingRole = member.role;
    next();
  };
}

/** Dla tras już za requireWeddingRole("VIEWER"): wymaga wyższej roli do zapisu. */
export function requireRole(minRole: WeddingRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.weddingRole || !hasRole(req.weddingRole, minRole)) throw forbidden();
    next();
  };
}
