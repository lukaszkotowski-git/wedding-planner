import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, CalendarDays, Download, ExternalLink, Gift, LayoutDashboard, ListChecks, Settings, Users, UsersRound, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Redirect, Route, Switch, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Wedding } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BudgetPage } from "./budget";
import { CalendarPage } from "./calendar";
import { GiftsPage } from "./gifts";
import { GuestsPage } from "./guests";
import { OverviewPage } from "./overview";
import { SettingsPage } from "./settings";
import { TasksPage } from "./tasks";
import { TeamPage } from "./team";
import { VendorsPage } from "./vendors";
import { WeddingContext, weddingKeys } from "./context";

const NAV = [
  { path: "", icon: LayoutDashboard, label: "panel.overview" },
  { path: "/guests", icon: Users, label: "panel.guests" },
  { path: "/gifts", icon: Gift, label: "panel.gifts" },
  { path: "/tasks", icon: ListChecks, label: "panel.tasks" },
  { path: "/calendar", icon: CalendarDays, label: "panel.calendar" },
  { path: "/budget", icon: Wallet, label: "panel.budget" },
  { path: "/vendors", icon: Briefcase, label: "panel.vendors" },
  { path: "/settings", icon: Settings, label: "panel.settings" },
  { path: "/team", icon: UsersRound, label: "panel.team" },
] as const;

function NavItem({ path, icon: Icon, label }: (typeof NAV)[number]) {
  const { t } = useTranslation();
  const [active] = useRoute(path || "/");
  return (
    <Link
      href={path || "/"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-secondary text-foreground",
      )}
    >
      <Icon className="size-4" />
      {t(label)}
    </Link>
  );
}

/** Panel jednego wesela: /app/w/:id/... (zagnieżdżony routing wouter). */
export function WeddingLayout({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const { data: wedding, error, isPending } = useQuery({
    queryKey: weddingKeys.wedding(id),
    queryFn: () => api<Wedding>(`/weddings/${id}`),
  });

  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Redirect to="~/app" />;
  if (!wedding) return <p className="container py-16 text-destructive">{t("errors.generic")}</p>;

  const canExport = wedding.role !== "VIEWER";

  return (
    <WeddingContext.Provider value={wedding}>
      <div className="container py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Link href="~/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" />
              {t("panel.allWeddings")}
            </Link>
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
              {wedding.partnerOneName} & {wedding.partnerTwoName}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "long", timeZone: "UTC" }).format(new Date(wedding.date))}</span>
              <Badge variant="muted">{t("panel.plan", { plan: t(`plans.${wedding.plan}`) })}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/w/${wedding.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                {t("panel.publicPage")}
              </a>
            </Button>
            {canExport && (
              <Button asChild size="sm">
                <a href={`/api/weddings/${id}/export/xlsx?lang=${i18n.resolvedLanguage ?? "pl"}`} download>
                  <Download />
                  {t("panel.export")}
                </a>
              </Button>
            )}
          </div>
        </div>

        <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b px-1 pb-2">
          {NAV.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>

        <Switch>
          <Route path="/" component={OverviewPage} />
          <Route path="/guests" component={GuestsPage} />
          <Route path="/gifts" component={GiftsPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/budget" component={BudgetPage} />
          <Route path="/vendors" component={VendorsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/team" component={TeamPage} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </div>
    </WeddingContext.Provider>
  );
}
