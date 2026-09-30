import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type { Team } from "@/lib/types";
import { useCan, useWedding, useWeddingData, weddingKeys } from "./context";

const INVITABLE = ["PARTNER", "CO_PLANNER", "VIEWER"] as const;

export function TeamPage() {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const canInvite = useCan("PARTNER");
  const { data } = useWeddingData<Team>("team", "/team");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITABLE)[number]>("PARTNER");

  const invalidate = () => qc.invalidateQueries({ queryKey: weddingKeys.team(wedding.id) });
  const onError = (e: unknown) => toast.error(errorMessage(t, e));

  const invite = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/team/invitations`, { method: "POST", json: { email, role } }),
    onSuccess: () => {
      setEmail("");
      toast.success(t("team.sent"));
      void invalidate();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/weddings/${wedding.id}/team/invitations/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  });
  const removeMember = useMutation({
    mutationFn: ({ id }: { id: string; isMe: boolean }) => api(`/weddings/${wedding.id}/team/members/${id}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      if (v.isMe) {
        void qc.invalidateQueries({ queryKey: ["weddings"] });
        navigate("~/app");
      } else void invalidate();
    },
    onError,
  });

  const canRemove = (memberRole: string, isMe: boolean) =>
    memberRole !== "OWNER" &&
    (isMe || wedding.role === "OWNER" || (wedding.role === "PARTNER" && (memberRole === "CO_PLANNER" || memberRole === "VIEWER")));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("team.members")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">
                  {m.user.name} {m.isMe && <span className="text-muted-foreground">({t("team.you")})</span>}
                </p>
                <p className="truncate text-muted-foreground">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={m.role === "OWNER" ? "success" : "default"}>{t(`team.roles.${m.role}`)}</Badge>
                {canRemove(m.role, m.isMe) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={m.isMe ? t("team.leave") : t("team.remove")}
                    title={m.isMe ? t("team.leave") : t("team.remove")}
                    onClick={() => confirm(`${m.isMe ? t("team.leave") : t("team.remove")}?`) && removeMember.mutate({ id: m.id, isMe: m.isMe })}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!!data?.invitations.length && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">{t("team.pending")}</p>
              {data.invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {inv.email} · {t(`team.roles.${inv.role}`)}
                    <span className="block text-xs text-muted-foreground">
                      {t("team.expires", { date: formatDate(inv.expiresAt.slice(0, 10), i18n.resolvedLanguage, "medium") })}
                    </span>
                  </span>
                  {canInvite && (
                    <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => revoke.mutate(inv.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.invite")}</CardTitle>
            <CardDescription>{t("team.inviteHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <Field id="inv-email" label={t("auth.email")}>
                <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field id="inv-role" label={t("team.role")}>
                <NativeSelect id="inv-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  {INVITABLE.map((r) => (
                    <option key={r} value={r}>
                      {t(`team.roles.${r}`)}: {t(`team.roleHints.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={invite.isPending || !email}>
                {t("team.send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
