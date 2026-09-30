import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

interface InvitationInfo {
  email: string;
  role: string;
  couple: string;
  emailMatches: boolean;
}

export function InvitePage({ token }: { token: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["invitation", token], queryFn: () => api<InvitationInfo>(`/invitations/${token}`), retry: false });
  const accept = useMutation({
    mutationFn: () => api<{ weddingId: string }>(`/invitations/${token}/accept`, { method: "POST" }),
    onSuccess: ({ weddingId }) => {
      void qc.invalidateQueries({ queryKey: ["weddings"] });
      navigate(`/app/w/${weddingId}`);
    },
  });

  return (
    <div className="container flex justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-serif text-3xl">{t("invite.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {info.isPending && <p className="text-muted-foreground">{t("common.loading")}</p>}
          {info.isError && <p className="text-destructive">{errorMessage(t, info.error)}</p>}
          {info.data && (
            <>
              <p>{t("invite.body", { couple: info.data.couple, role: t(`team.roles.${info.data.role}`) })}</p>
              {info.data.emailMatches ? (
                <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                  {t("invite.accept")}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{t("invite.mismatch", { email: info.data.email })}</p>
              )}
              {accept.isError && <p className="text-sm text-destructive">{errorMessage(t, accept.error)}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
