import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

/** /w/:slug/gift?confirm=… lub ?cancel=…: linki z maili rezerwacji prezentu. */
export function GiftActionPage() {
  const { t } = useTranslation();
  const params = new URLSearchParams(useSearch());
  const confirmToken = params.get("confirm");
  const cancelToken = params.get("cancel");
  const action = confirmToken ? "confirm" : "cancel";
  const token = confirmToken ?? cancelToken;

  const run = useMutation({
    mutationFn: () => api<{ giftTitle: string }>(`/public/gift-reservations/${action}`, { method: "POST", json: { token } }),
  });
  const { mutate } = run;

  // Jednorazowo po wejściu z linku. Operacje są idempotentne, więc podwójne wywołanie w StrictMode niczego nie psuje.
  useEffect(() => {
    if (token) mutate();
  }, [token, mutate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {run.isPending || run.isIdle ? (
            <p className="text-muted-foreground">{action === "confirm" ? t("giftAction.confirming") : t("giftAction.cancelling")}</p>
          ) : run.isSuccess ? (
            <>
              <CheckCircle2 className="size-10 text-emerald-600" />
              <p className="font-serif text-2xl font-semibold">
                {action === "confirm" ? t("giftAction.confirmed", { gift: run.data.giftTitle }) : t("giftAction.cancelled", { gift: run.data.giftTitle })}
              </p>
              {action === "confirm" && <p className="text-sm text-muted-foreground">{t("giftAction.confirmedHint")}</p>}
            </>
          ) : (
            <>
              <XCircle className="size-10 text-destructive" />
              <p>{errorMessage(t, run.error)}</p>
            </>
          )}
          <Button asChild variant="outline">
            <Link href="/">{t("giftAction.backToPage")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
