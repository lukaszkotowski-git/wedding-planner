import { WEDDING_ROLES } from "@wedding/shared";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../env";
import { prisma } from "../../lib/db";
import { badRequest, conflict, forbidden, gone, notFound, param } from "../../lib/http";
import { t } from "../../lib/i18n";
import { sendMailInBackground } from "../../lib/mail";
import { assertWithinLimit } from "../../lib/plan";
import { randomToken } from "../../lib/tokens";
import { requireAuth, requireRole } from "../../middleware/auth";
import { coupleName } from "../weddings/serialize";

const INVITABLE_ROLES = WEDDING_ROLES.filter((r) => r !== "OWNER") as ["PARTNER", "CO_PLANNER", "VIEWER"];
const INVITATION_DAYS = 14;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(INVITABLE_ROLES),
});

export const teamRouter = Router({ mergeParams: true });

teamRouter.get("/", async (req, res) => {
  const [members, invitations] = await Promise.all([
    prisma.weddingMember.findMany({
      where: { weddingId: req.wedding!.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.teamInvitation.findMany({
      where: { weddingId: req.wedding!.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  res.json({
    members: members.map((m) => ({ id: m.id, role: m.role, user: m.user, isMe: m.userId === req.user!.id })),
    invitations,
  });
});

teamRouter.post("/invitations", requireRole("PARTNER"), async (req, res) => {
  const input = inviteSchema.parse(req.body);
  const wedding = req.wedding!;
  const [members, pending, already] = await Promise.all([
    prisma.weddingMember.count({ where: { weddingId: wedding.id } }),
    prisma.teamInvitation.count({ where: { weddingId: wedding.id, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.weddingMember.findFirst({ where: { weddingId: wedding.id, user: { email: input.email } } }),
  ]);
  if (already) throw conflict("already_member");
  // Właściciel nie wlicza się do limitu zespołu.
  assertWithinLimit(wedding, "teamMembers", members - 1 + pending + 1);

  const token = randomToken(32);
  const invitation = await prisma.teamInvitation.create({
    data: {
      weddingId: wedding.id,
      email: input.email,
      role: input.role,
      token,
      invitedById: req.user!.id,
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
    },
  });
  const couple = coupleName(wedding);
  sendMailInBackground({
    to: input.email,
    locale: wedding.locale,
    subject: t(wedding.locale, "mail.teamInvite.subject", { couple }),
    body: t(wedding.locale, "mail.teamInvite.body", { couple, inviter: req.user!.name }),
    cta: t(wedding.locale, "mail.teamInvite.cta"),
    url: `${env.APP_URL}/invite/${token}`,
  });
  res.status(201).json({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt });
});

teamRouter.delete("/invitations/:id", requireRole("PARTNER"), async (req, res) => {
  const { count } = await prisma.teamInvitation.deleteMany({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!count) throw notFound();
  res.status(204).end();
});

teamRouter.patch("/members/:id", requireRole("OWNER"), async (req, res) => {
  const { role } = z.object({ role: z.enum(INVITABLE_ROLES) }).parse(req.body);
  const member = await prisma.weddingMember.findFirst({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!member) throw notFound();
  if (member.role === "OWNER") throw badRequest("cannot_change_owner");
  await prisma.weddingMember.update({ where: { id: member.id }, data: { role } });
  res.json({ ok: true });
});

/** Właściciel usuwa każdego poza sobą; partner tylko współorganizatorów i obserwatorów; każdy może odejść sam. */
teamRouter.delete("/members/:id", async (req, res) => {
  const member = await prisma.weddingMember.findFirst({ where: { id: param(req, "id"), weddingId: req.wedding!.id } });
  if (!member) throw notFound();
  if (member.role === "OWNER") throw badRequest("cannot_remove_owner");
  const self = member.userId === req.user!.id;
  const me = req.weddingRole!;
  const allowed = self || me === "OWNER" || (me === "PARTNER" && (member.role === "CO_PLANNER" || member.role === "VIEWER"));
  if (!allowed) throw forbidden();
  await prisma.weddingMember.delete({ where: { id: member.id } });
  res.status(204).end();
});

// ─── Przyjęcie zaproszenia (poza kontekstem wesela) ─────────────

export const invitationsRouter = Router();
invitationsRouter.use(requireAuth);

async function loadInvitation(token: string) {
  const inv = await prisma.teamInvitation.findUnique({ where: { token }, include: { wedding: true } });
  if (!inv || inv.wedding.deletedAt) throw notFound();
  if (inv.acceptedAt) throw gone("invitation_used");
  if (inv.expiresAt <= new Date()) throw gone("invitation_expired");
  return inv;
}

invitationsRouter.get("/:token", async (req, res) => {
  const inv = await loadInvitation(param(req, "token"));
  res.json({
    email: inv.email,
    role: inv.role,
    couple: coupleName(inv.wedding),
    emailMatches: inv.email === req.user!.email.toLowerCase(),
  });
});

/** Zaproszenie przyjmuje tylko konto z tym samym adresem, na który je wysłano. */
invitationsRouter.post("/:token/accept", async (req, res) => {
  const inv = await loadInvitation(param(req, "token"));
  if (inv.email !== req.user!.email.toLowerCase()) throw forbidden();
  await prisma.$transaction([
    prisma.weddingMember.upsert({
      where: { weddingId_userId: { weddingId: inv.weddingId, userId: req.user!.id } },
      create: { weddingId: inv.weddingId, userId: req.user!.id, role: inv.role },
      update: {},
    }),
    prisma.teamInvitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  res.json({ weddingId: inv.weddingId });
});
