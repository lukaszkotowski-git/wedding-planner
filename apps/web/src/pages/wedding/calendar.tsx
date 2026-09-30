import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLANS, type CalendarEntryInput } from "@wedding/shared";
import { ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type { CalendarEntry, CalendarItem, CalendarKind, Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan, useWedding, weddingKeys } from "./context";

const KIND_STYLE: Record<CalendarKind, { chip: string; dot: string }> = {
  PART: { chip: "bg-primary text-primary-foreground", dot: "bg-primary" },
  TASK: { chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", dot: "bg-sky-500" },
  PAYMENT: { chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", dot: "bg-amber-500" },
  ENTRY: { chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200", dot: "bg-emerald-500" },
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Siatka miesiąca od poniedziałku do niedzieli (daty w UTC, bez przesunięć strefowych). */
function monthGrid(year: number, month: number) {
  const first = utc(year, month, 1);
  const start = utc(year, month, 1 - ((first.getUTCDay() + 6) % 7));
  const last = utc(year, month + 1, 0);
  const end = utc(year, month + 1, (7 - last.getUTCDay()) % 7);
  const days: string[] = [];
  for (let d = start; d <= end; d = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) days.push(iso(d));
  return days;
}

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const canEdit = useCan("CO_PLANNER");
  const lang = i18n.resolvedLanguage;
  const today = iso(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEntry | { startsAt: string } | null>(null);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const { data: items = [] } = useQuery({
    queryKey: weddingKeys.calendar(wedding.id, from, to),
    queryFn: () => api<CalendarItem[]>(`/weddings/${wedding.id}/calendar?from=${from}&to=${to}`),
  });
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [items]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const listed = selected ? (byDay.get(selected) ?? []) : items.filter((i) => i.date.startsWith(monthPrefix));
  const title = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(cursor.year, cursor.month, 1));
  const weekdays = t("calendar.weekdays").split(",");

  const move = (delta: number) => {
    setSelected(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const openEntry = async (item: CalendarItem) => {
    if (item.kind !== "ENTRY" || !canEdit) return;
    try {
      setEditing(await api<CalendarEntry>(`/weddings/${wedding.id}/calendar/entries/${item.refId}`));
    } catch (e) {
      toast.error(errorMessage(t, e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="min-w-0">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <h2 className="font-serif text-2xl font-semibold capitalize" aria-live="polite">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={t("calendar.prev")} onClick={() => move(-1)}>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
                setSelected(today);
              }}
            >
              {t("calendar.today")}
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("calendar.next")} onClick={() => move(1)}>
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {weekdays.map((d) => (
              <div key={d} className="pb-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t">
            {days.map((day) => {
              const list = byDay.get(day) ?? [];
              const inMonth = day.startsWith(monthPrefix);
              const isWedding = day === wedding.date;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(selected === day ? null : day)}
                  aria-pressed={selected === day}
                  aria-label={`${formatDate(day, lang, "full")}${list.length ? `, ${list.length}` : ""}`}
                  className={cn(
                    "flex min-h-14 flex-col gap-1 border-b border-r p-1 text-left align-top transition-colors hover:bg-accent sm:min-h-24",
                    !inMonth && "bg-muted/40 text-muted-foreground",
                    selected === day && "bg-accent ring-2 ring-inset ring-primary",
                    isWedding && "bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      day === today && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {/* Telefon: kropki; szerszy ekran: etykiety */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((i) => (
                      <span key={i.id} className={cn("size-1.5 rounded-full", KIND_STYLE[i.kind].dot, i.done && "opacity-40")} />
                    ))}
                  </span>
                  <span className="hidden w-full space-y-0.5 sm:block">
                    {list.slice(0, 3).map((i) => (
                      <span
                        key={i.id}
                        className={cn("block truncate rounded px-1 py-0.5 text-[11px] leading-tight", KIND_STYLE[i.kind].chip, i.done && "line-through opacity-50")}
                      >
                        {i.time && `${i.time} `}
                        {i.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="block px-1 text-[11px] text-muted-foreground">{t("calendar.more", { count: list.length - 3 })}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(Object.keys(KIND_STYLE) as CalendarKind[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", KIND_STYLE[k].dot)} />
                {t(`calendar.kinds.${k}`)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{selected ? formatDate(selected, lang, "full") : title}</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing({ startsAt: `${selected ?? today}T12:00` })}>
              <Plus />
              {t("calendar.addEntry")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {listed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("calendar.nothing")}</p>
          ) : (
            <ul className="space-y-3">
              {listed.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => void openEntry(i)}
                    disabled={i.kind !== "ENTRY" || !canEdit}
                    className="flex w-full gap-3 text-left disabled:cursor-default"
                  >
                    <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", KIND_STYLE[i.kind].dot)} />
                    <span className="min-w-0 text-sm">
                      <span className={cn("block font-medium", i.done && "text-muted-foreground line-through")}>{i.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {!selected && `${formatDate(i.date, lang, "medium")} · `}
                        {i.time ? `${i.time}${i.endTime ? `–${i.endTime}` : ""}` : t("calendar.allDay")} · {t(`calendar.kinds.${i.kind}`)}
                      </span>
                      {i.location && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {i.location}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && <EntryDialog entry={"id" in editing ? editing : null} defaultStart={editing.startsAt} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EntryDialog({ entry, defaultStart, onClose }: { entry: CalendarEntry | null; defaultStart: string; onClose: () => void }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const hasVendors = PLANS[wedding.plan].features.vendors;
  const { data: vendors = [] } = useQuery({
    queryKey: weddingKeys.vendors(wedding.id),
    queryFn: () => api<Vendor[]>(`/weddings/${wedding.id}/vendors`),
    enabled: hasVendors,
  });
  const form = useForm<{ title: string; startsAt: string; endsAt: string; location: string; notes: string; vendorId: string }>({
    defaultValues: {
      title: entry?.title ?? "",
      startsAt: entry?.startsAt ?? defaultStart,
      endsAt: entry?.endsAt ?? "",
      location: entry?.location ?? "",
      notes: entry?.notes ?? "",
      vendorId: entry?.vendorId ?? "",
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["wedding", wedding.id, "calendar"] });
  const save = useMutation({
    mutationFn: (v: CalendarEntryInput) =>
      entry
        ? api(`/weddings/${wedding.id}/calendar/entries/${entry.id}`, { method: "PUT", json: v })
        : api(`/weddings/${wedding.id}/calendar/entries`, { method: "POST", json: v }),
    onSuccess: () => {
      void refresh();
      toast.success(t("common.saved"));
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/calendar/entries/${entry!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? t("calendar.editEntry") : t("calendar.addEntry")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field id="e-title" label={t("calendar.entryTitle")}>
            <Input id="e-title" {...form.register("title", { required: true })} aria-invalid={!!form.formState.errors.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="e-start" label={t("calendar.startsAt")}>
              <Input id="e-start" type="datetime-local" {...form.register("startsAt", { required: true })} />
            </Field>
            <Field id="e-end" label={t("calendar.endsAt")}>
              <Input id="e-end" type="datetime-local" {...form.register("endsAt")} />
            </Field>
          </div>
          <Field id="e-loc" label={t("calendar.location")}>
            <Input id="e-loc" {...form.register("location")} />
          </Field>
          {hasVendors && (
            <Field id="e-vendor" label={t("calendar.vendor")}>
              <NativeSelect id="e-vendor" {...form.register("vendorId")}>
                <option value="">{t("calendar.none")}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id="e-notes" label={t("calendar.notes")}>
            <Textarea id="e-notes" rows={2} {...form.register("notes")} />
          </Field>
          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex items-center justify-between gap-2">
            {entry ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => confirm(t("common.confirmDelete")) && remove.mutate()}>
                <Trash2 />
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
