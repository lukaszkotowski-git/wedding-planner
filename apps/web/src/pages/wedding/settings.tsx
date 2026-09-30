import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CEREMONY_TYPES, LOCALES, RSVP_MODES, type UpdateWeddingInput } from "@wedding/shared";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatTime } from "@/lib/format";
import type { ChildTier, EventPart, MealOption, Wedding } from "@/lib/types";
import { useCan, useWedding, useWeddingData, weddingKeys } from "./context";

export function SettingsPage() {
  const canEdit = useCan("PARTNER");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <DetailsForm disabled={!canEdit} />
      </div>
      <div className="space-y-6">
        <PartsSection canEdit={canEdit} />
        <MealsSection canEdit={canEdit} />
        <TiersSection canEdit={canEdit} />
      </div>
    </div>
  );
}

// ─── Szczegóły, RSVP, treść strony ──────────────────────────────

function DetailsForm({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const form = useForm<UpdateWeddingInput>({
    defaultValues: {
      partnerOneName: wedding.partnerOneName,
      partnerTwoName: wedding.partnerTwoName,
      date: wedding.date,
      ceremonyType: wedding.ceremonyType,
      slug: wedding.slug,
      locale: wedding.locale,
      rsvpMode: wedding.rsvpMode,
      rsvpDeadline: wedding.rsvpDeadline ?? "",
      welcomeMessage: wedding.welcomeMessage ?? "",
      giftsIntro: wedding.giftsIntro ?? "",
      cashGiftInfo: wedding.cashGiftInfo ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (v: UpdateWeddingInput) => api<Wedding>(`/weddings/${wedding.id}`, { method: "PATCH", json: v }),
    onSuccess: (w) => {
      qc.setQueryData(weddingKeys.wedding(wedding.id), w);
      void qc.invalidateQueries({ queryKey: ["weddings"] });
      toast.success(t("common.saved"));
    },
  });

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <fieldset disabled={disabled} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="s-p1" label={t("wedding.partnerOne")}>
              <Input id="s-p1" {...form.register("partnerOneName", { required: true })} />
            </Field>
            <Field id="s-p2" label={t("wedding.partnerTwo")}>
              <Input id="s-p2" {...form.register("partnerTwoName", { required: true })} />
            </Field>
            <Field id="s-date" label={t("wedding.date")}>
              <Input id="s-date" type="date" {...form.register("date", { required: true })} />
            </Field>
            <Field id="s-ceremony" label={t("wedding.ceremonyType")}>
              <NativeSelect id="s-ceremony" {...form.register("ceremonyType")}>
                {CEREMONY_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(`wedding.ceremony.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="s-slug" label={t("wedding.slug")}>
              <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">/w/</span>
                <Input id="s-slug" className="border-0 shadow-none focus-visible:ring-0" {...form.register("slug", { required: true })} />
              </div>
            </Field>
            <Field id="s-locale" label={t("wedding.locale")}>
              <NativeSelect id="s-locale" {...form.register("locale")}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.rsvp")}</CardTitle>
            <CardDescription>{t("settings.rsvpModeHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="s-mode" label={t("settings.rsvpMode")}>
              <NativeSelect id="s-mode" {...form.register("rsvpMode")}>
                {RSVP_MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`settings.rsvpModes.${m}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="s-deadline" label={t("settings.rsvpDeadline")}>
              <Input id="s-deadline" type="date" {...form.register("rsvpDeadline")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.pageContent")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field id="s-welcome" label={t("settings.welcomeMessage")}>
              <Textarea id="s-welcome" rows={4} {...form.register("welcomeMessage")} />
            </Field>
            <Field id="s-gifts" label={t("settings.giftsIntro")}>
              <Textarea id="s-gifts" rows={2} {...form.register("giftsIntro")} />
            </Field>
            <Field id="s-cash" label={t("settings.cashGiftInfo")}>
              <Textarea id="s-cash" rows={2} placeholder={t("settings.cashGiftHint")} {...form.register("cashGiftInfo")} />
            </Field>
          </CardContent>
        </Card>

        {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
        {!disabled && (
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        )}
      </fieldset>
    </form>
  );
}

// ─── Części wydarzenia ──────────────────────────────────────────

function PartsSection({ canEdit }: { canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const { data: parts } = useWeddingData<EventPart[]>("parts", "/event-parts");
  const [editing, setEditing] = useState<EventPart | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/weddings/${wedding.id}/event-parts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding", wedding.id] }),
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("settings.parts")}</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus />
            {t("settings.addPart")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {parts?.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5 text-sm">
              <p className="font-medium">{p.name}</p>
              <p className="text-muted-foreground">
                {formatDateTime(p.startsAt, i18n.resolvedLanguage)}
                {p.endsAt && ` – ${formatTime(p.endsAt, i18n.resolvedLanguage)}`}
              </p>
              {(p.locationName || p.address) && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {[p.locationName, p.address].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex">
                <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(p)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(p.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
      {editing && <PartDialog part={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

type PartForm = Omit<EventPart, "id" | "endsAt" | "locationName" | "address" | "mapUrl" | "notes"> & {
  endsAt: string;
  locationName: string;
  address: string;
  mapUrl: string;
  notes: string;
};

function PartDialog({ part, onClose }: { part: EventPart | null; onClose: () => void }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const form = useForm<PartForm>({
    defaultValues: {
      name: part?.name ?? "",
      startsAt: part?.startsAt ?? `${wedding.date}T16:00`,
      endsAt: part?.endsAt ?? "",
      locationName: part?.locationName ?? "",
      address: part?.address ?? "",
      mapUrl: part?.mapUrl ?? "",
      notes: part?.notes ?? "",
      order: part?.order ?? 0,
    },
  });
  const save = useMutation({
    mutationFn: (v: PartForm) =>
      part
        ? api(`/weddings/${wedding.id}/event-parts/${part.id}`, { method: "PUT", json: v })
        : api(`/weddings/${wedding.id}/event-parts`, { method: "POST", json: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wedding", wedding.id] });
      toast.success(t("common.saved"));
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{part ? part.name : t("settings.addPart")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field id="p-name" label={t("settings.partName")}>
            <Input id="p-name" {...form.register("name", { required: true })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-start" label={t("settings.startsAt")}>
              <Input id="p-start" type="datetime-local" {...form.register("startsAt", { required: true })} />
            </Field>
            <Field id="p-end" label={t("settings.endsAt")}>
              <Input id="p-end" type="datetime-local" {...form.register("endsAt")} />
            </Field>
          </div>
          <Field id="p-loc" label={t("settings.locationName")}>
            <Input id="p-loc" {...form.register("locationName")} />
          </Field>
          <Field id="p-addr" label={t("settings.address")}>
            <Input id="p-addr" {...form.register("address")} />
          </Field>
          <Field id="p-map" label={t("settings.mapUrl")}>
            <Input id="p-map" type="url" placeholder="https://maps.google.com/…" {...form.register("mapUrl")} />
          </Field>
          <Field id="p-notes" label={t("settings.partNotes")}>
            <Textarea id="p-notes" rows={2} {...form.register("notes")} />
          </Field>
          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Menu ───────────────────────────────────────────────────────

function MealsSection({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const { data: meals } = useWeddingData<MealOption[]>("meals", "/meal-options");
  const [draft, setDraft] = useState({ name: "", forChildren: false });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["wedding", wedding.id] });
  const onError = (e: unknown) => toast.error(errorMessage(t, e));
  const add = useMutation({
    mutationFn: () =>
      api(`/weddings/${wedding.id}/meal-options`, { method: "POST", json: { ...draft, order: meals?.length ?? 0 } }),
    onSuccess: () => {
      setDraft({ name: "", forChildren: false });
      void invalidate();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (m: MealOption) => api(`/weddings/${wedding.id}/meal-options/${m.id}`, { method: "PUT", json: m }),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/weddings/${wedding.id}/meal-options/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.meals")}</CardTitle>
        {canEdit && <CardDescription>{t("settings.mealDeleteHint")}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {meals?.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span className={m.active ? "" : "text-muted-foreground line-through"}>
              {m.name} {m.forChildren && <Badge variant="muted">{t("settings.forChildren")}</Badge>}
            </span>
            {canEdit && (
              <div className="flex items-center gap-3">
                <CheckboxField
                  label={t("settings.active")}
                  checked={m.active}
                  onChange={(e) => update.mutate({ ...m, active: e.target.checked })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  onClick={() => confirm(t("settings.mealDeleteHint")) && remove.mutate(m.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <form
            className="flex flex-wrap items-center gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.name.trim()) add.mutate();
            }}
          >
            <Input
              className="min-w-40 flex-1"
              placeholder={t("settings.mealName")}
              aria-label={t("settings.mealName")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <CheckboxField
              label={t("settings.forChildren")}
              checked={draft.forChildren}
              onChange={(e) => setDraft({ ...draft, forChildren: e.target.checked })}
            />
            <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
              <Plus />
              {t("settings.addMeal")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progi cenowe dzieci ────────────────────────────────────────

function TiersSection({ canEdit }: { canEdit: boolean }) {
  const { data } = useWeddingData<ChildTier[]>("tiers", "/child-tiers");
  if (!data) return null;
  // key: po zapisie serwer zwraca nowe id, więc formularz startuje od świeżych danych.
  return <TiersForm key={data.map((d) => d.id).join()} initial={data} canEdit={canEdit} />;
}

function TiersForm({ initial, canEdit }: { initial: ChildTier[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const form = useForm<{ tiers: { fromAge: string; toAge: string; pricePercent: string }[] }>({
    defaultValues: {
      tiers: initial.map((x) => ({ fromAge: String(x.fromAge), toAge: String(x.toAge), pricePercent: String(x.pricePercent) })),
    },
  });
  const tiers = useFieldArray({ control: form.control, name: "tiers" });
  const save = useMutation({
    mutationFn: (v: { tiers: { fromAge: string; toAge: string; pricePercent: string }[] }) =>
      api(`/weddings/${wedding.id}/child-tiers`, { method: "PUT", json: v.tiers }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wedding", wedding.id] });
      toast.success(t("common.saved"));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.childTiers")}</CardTitle>
        <CardDescription>{t("settings.childTiersHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
          <fieldset disabled={!canEdit} className="space-y-2">
            {tiers.fields.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2">
                <Field id={`t-from-${i}`} label={t("settings.fromAge")}>
                  <Input id={`t-from-${i}`} type="number" min={0} max={17} {...form.register(`tiers.${i}.fromAge`)} />
                </Field>
                <Field id={`t-to-${i}`} label={t("settings.toAge")}>
                  <Input id={`t-to-${i}`} type="number" min={0} max={17} {...form.register(`tiers.${i}.toAge`)} />
                </Field>
                <Field id={`t-pct-${i}`} label={t("settings.percent")}>
                  <Input id={`t-pct-${i}`} type="number" min={0} max={100} {...form.register(`tiers.${i}.pricePercent`)} />
                </Field>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => tiers.remove(i)}>
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </fieldset>
          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          {canEdit && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => tiers.append({ fromAge: "", toAge: "", pricePercent: "" })}>
                <Plus />
                {t("settings.addTier")}
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {t("common.save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
