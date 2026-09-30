import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { daysUntil } from "@/lib/format";
import type { Stats } from "@/lib/types";
import { useWedding, weddingKeys } from "./context";

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-serif text-4xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Pozioma belka proporcji: wartość względem całości. */
function Bar({ label, value, total }: { label: ReactNode; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}
          {total > 0 && <span className="text-xs"> / {total}</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { t } = useTranslation();
  const wedding = useWedding();
  const { data: s } = useQuery({
    queryKey: weddingKeys.stats(wedding.id),
    queryFn: () => api<Stats>(`/weddings/${wedding.id}/stats`),
  });
  if (!s) return <p className="text-muted-foreground">{t("common.loading")}</p>;

  const days = daysUntil(wedding.date);

  if (s.households.total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          {days >= 0 && <p className="font-serif text-5xl font-semibold">{t("dashboard.daysLeft", { count: days })}</p>}
          <p className="text-muted-foreground">{t("overview.empty")}</p>
          <Button asChild>
            <Link href="/guests">{t("overview.addGuests")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const mealTotal = s.meals.reduce((sum, m) => sum + m.count, 0);
  const childTotal = s.children.tiers.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {s.pendingJoinRequests > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("overview.joinRequests", { count: s.pendingJoinRequests })}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/guests">{t("overview.review")}</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("overview.invitations")}
          value={s.households.total}
          hint={t("overview.responded", { count: s.households.responded, total: s.households.total })}
        />
        <Stat
          label={t("overview.attending")}
          value={s.guests.attending}
          hint={`${s.guests.attendingAdults} ${t("overview.adults")} · ${s.guests.attendingChildren} ${t("overview.children")}${
            s.guests.plusOnes ? ` · ${s.guests.plusOnes} ${t("overview.plusOnes")}` : ""
          }`}
        />
        <Stat label={t("overview.declined")} value={s.guests.declined} />
        <Stat label={t("overview.pending")} value={s.guests.pending} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.parts")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.parts.map((p) => (
              <Bar key={p.id} label={p.name} value={p.attending} total={p.invited} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.meals")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.meals
              .filter((m) => m.id || m.count > 0)
              .map((m) => (
                <Bar key={m.id ?? "none"} label={m.name ?? t("overview.noMeal")} value={m.count} total={mealTotal} />
              ))}
            {s.dietNotes > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("overview.dietNotes")}: <strong className="text-foreground">{s.dietNotes}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.childTiers")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.children.tiers
              .filter((c) => c.fromAge !== null || c.count > 0)
              .map((c) => (
                <Bar
                  key={`${c.fromAge}-${c.toAge}`}
                  label={c.fromAge === null ? t("overview.outsideTiers") : `${c.fromAge}–${c.toAge} · ${c.pricePercent}%`}
                  value={c.count}
                  total={childTotal}
                />
              ))}
            <p className="text-sm text-muted-foreground">
              {t("overview.highChairs")}: <strong className="text-foreground">{s.children.highChairs}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.logistics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex justify-between">
              <span>{t("overview.accommodation")}</span>
              <strong className="tabular-nums">{s.logistics.accommodation}</strong>
            </p>
            <p className="flex justify-between">
              <span>{t("overview.transport")}</span>
              <strong className="tabular-nums">{s.logistics.transport}</strong>
            </p>
            <p className="flex justify-between">
              <span>{t("overview.gifts")}</span>
              <strong className="tabular-nums">
                {t("overview.giftsReserved", { reserved: s.gifts.reserved, total: s.gifts.total })}
              </strong>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
