import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GUEST_SIDES, type HouseholdInput } from "@wedding/shared";
import { Baby, Copy, Link2, LockOpen, Pencil, Plus, QrCode, Search, Trash2, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type { EventPart, GuestRow, Household, HouseholdStatus, JoinRequest, MealOption } from "@/lib/types";
import { useCan, useWedding, useWeddingData, weddingKeys } from "./context";

const STATUS_VARIANT = { PENDING: "warning", ATTENDING: "success", DECLINED: "muted" } as const;

function useInvalidateGuests() {
  const qc = useQueryClient();
  const { id } = useWedding();
  return () => {
    void qc.invalidateQueries({ queryKey: weddingKeys.households(id) });
    void qc.invalidateQueries({ queryKey: weddingKeys.stats(id) });
    void qc.invalidateQueries({ queryKey: weddingKeys.joinRequests(id) });
  };
}

export function GuestsPage() {
  const { t } = useTranslation();
  const wedding = useWedding();
  const canEdit = useCan("CO_PLANNER");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HouseholdStatus | "">("");
  const [editing, setEditing] = useState<Household | "new" | null>(null);

  const { data: households } = useWeddingData<Household[]>("households", "/households");
  const { data: parts = [] } = useWeddingData<EventPart[]>("parts", "/event-parts");
  const { data: meals = [] } = useWeddingData<MealOption[]>("meals", "/meal-options");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (households ?? []).filter((h) => {
      if (status && h.status !== status) return false;
      if (!q) return true;
      const haystack = [h.name, h.email, ...h.tags, ...h.guests.flatMap((g) => [g.firstName, g.lastName, g.plusOne?.firstName, g.plusOne?.lastName])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [households, query, status]);

  const peopleCount = (households ?? []).reduce((n, h) => n + h.guests.length + h.guests.filter((g) => g.plusOne).length, 0);

  return (
    <div className="space-y-6">
      <JoinRequests />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">
          {t("guests.title")}{" "}
          <span className="text-base font-normal text-muted-foreground">({t("guests.count", { count: peopleCount })})</span>
        </h2>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t("guests.addHousehold")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("guests.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("common.search")}
          />
        </div>
        <NativeSelect
          className="sm:w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value as HouseholdStatus | "")}
          aria-label={t("guests.filterStatus")}
        >
          <option value="">{t("common.all")}</option>
          {(["PENDING", "ATTENDING", "DECLINED"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`guests.status.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {!households ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : households.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t("guests.empty")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <HouseholdCard key={h.id} household={h} parts={parts} meals={meals} onEdit={() => setEditing(h)} canEdit={canEdit} />
          ))}
        </div>
      )}

      {editing && (
        <HouseholdDialog
          household={editing === "new" ? null : editing}
          parts={parts}
          meals={meals}
          partnerNames={[wedding.partnerOneName, wedding.partnerTwoName]}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Karta gospodarstwa ─────────────────────────────────────────

function HouseholdCard({
  household: h,
  parts,
  meals,
  onEdit,
  canEdit,
}: {
  household: Household;
  parts: EventPart[];
  meals: MealOption[];
  onEdit: () => void;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const invalidate = useInvalidateGuests();
  const mealName = (id: string | null) => meals.find((m) => m.id === id)?.name;
  const invited = h.invitedPartIds.length ? parts.filter((p) => h.invitedPartIds.includes(p.id)) : parts;

  const action = useMutation({
    mutationFn: (req: { path: string; method: string }) =>
      api(`/weddings/${wedding.id}/households/${h.id}${req.path}`, { method: req.method }),
    onSuccess: (_d, req) => {
      invalidate();
      if (req.path === "/unlock") toast.success(t("guests.unlocked"));
      if (req.method === "DELETE") toast.success(t("common.deleted"));
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(h.rsvpUrl);
    toast.success(t("common.copied"));
  };

  const person = (g: GuestRow, isPlusOne = false) => {
    const attending = invited.filter((p) => g.attendance[p.id]);
    return (
      <li key={g.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="font-medium">
          {g.firstName} {g.lastName}
        </span>
        {g.type === "CHILD" && (
          <Badge variant="muted">
            <Baby className="size-3" />
            {g.age != null ? t("rsvp.childAge", { age: g.age }) : t("guests.child")}
          </Badge>
        )}
        {isPlusOne && <Badge variant="muted">{t("guests.plusOne")}</Badge>}
        {!isPlusOne && g.plusOneAllowed && <span className="text-xs text-muted-foreground">+1</span>}
        {h.respondedAt && (
          <span className="text-muted-foreground">
            {attending.length ? attending.map((p) => p.name).join(", ") : t("guests.status.DECLINED")}
            {mealName(g.mealOptionId) && ` · ${mealName(g.mealOptionId)}`}
          </span>
        )}
        {g.dietNotes && <span className="text-xs text-amber-700 dark:text-amber-400">({g.dietNotes})</span>}
      </li>
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{h.name}</h3>
            <Badge variant={STATUS_VARIANT[h.status]}>{t(`guests.status.${h.status}`)}</Badge>
            {h.tags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>
          <ul className="space-y-1">
            {h.guests.flatMap((g) => [person(g), ...(g.plusOne ? [person(g.plusOne, true)] : [])])}
          </ul>
          {(h.needsAccommodation || h.needsTransport || h.messageToCouple) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {h.needsAccommodation && <Badge variant="default">{t("guests.accommodation")}</Badge>}
              {h.needsTransport && <Badge variant="default">{t("guests.transport")}</Badge>}
              {h.messageToCouple && <p className="w-full italic">„{h.messageToCouple}”</p>}
            </div>
          )}
          {h.respondedAt && (
            <p className="text-xs text-muted-foreground">
              {t("guests.answeredOn", { date: formatDate(h.respondedAt.slice(0, 10), i18n.resolvedLanguage, "medium") })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1">
          <Button variant="ghost" size="icon" title={t("guests.copyLink")} aria-label={t("guests.copyLink")} onClick={copyLink}>
            <Copy />
          </Button>
          <Button asChild variant="ghost" size="icon" title={t("guests.qr")} aria-label={t("guests.qr")}>
            <a href={`/api/weddings/${wedding.id}/households/${h.id}/qr.svg`} download={`qr-${h.name}.svg`}>
              <QrCode />
            </a>
          </Button>
          {canEdit && (
            <>
              {h.locked && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("guests.unlock")}
                  aria-label={t("guests.unlock")}
                  onClick={() => action.mutate({ path: "/unlock", method: "POST" })}
                >
                  <LockOpen />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title={t("guests.regenerate")}
                aria-label={t("guests.regenerate")}
                onClick={() => confirm(t("guests.regenerateConfirm")) && action.mutate({ path: "/regenerate-token", method: "POST" })}
              >
                <Link2 />
              </Button>
              <Button variant="ghost" size="icon" title={t("common.edit")} aria-label={t("common.edit")} onClick={onEdit}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={t("common.delete")}
                aria-label={t("common.delete")}
                onClick={() => confirm(t("common.confirmDelete")) && action.mutate({ path: "", method: "DELETE" })}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Formularz gospodarstwa ─────────────────────────────────────

interface GuestFormValue {
  id?: string;
  firstName: string;
  lastName: string;
  type: "ADULT" | "CHILD";
  age: string;
  plusOneAllowed: boolean;
  mealOptionId: string;
  needsHighChair: boolean;
  needsSeparateSeat: boolean;
}

interface HouseholdFormValue {
  name: string;
  email: string;
  phone: string;
  side: (typeof GUEST_SIDES)[number];
  tags: string;
  notes: string;
  invitedPartIds: string[];
  guests: GuestFormValue[];
}

const emptyGuest = (type: "ADULT" | "CHILD", lastName = ""): GuestFormValue => ({
  firstName: "",
  lastName,
  type,
  age: "",
  plusOneAllowed: false,
  mealOptionId: "",
  needsHighChair: false,
  needsSeparateSeat: true,
});

function HouseholdDialog({
  household,
  parts,
  meals,
  partnerNames,
  onClose,
}: {
  household: Household | null;
  parts: EventPart[];
  meals: MealOption[];
  partnerNames: [string, string];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const invalidate = useInvalidateGuests();

  const form = useForm<HouseholdFormValue>({
    defaultValues: household
      ? {
          name: household.name,
          email: household.email ?? "",
          phone: household.phone ?? "",
          side: household.side,
          tags: household.tags.join(", "),
          notes: household.notes ?? "",
          invitedPartIds: household.invitedPartIds.length ? household.invitedPartIds : parts.map((p) => p.id),
          guests: household.guests.map((g) => ({
            id: g.id,
            firstName: g.firstName,
            lastName: g.lastName,
            type: g.type,
            age: g.age?.toString() ?? "",
            plusOneAllowed: g.plusOneAllowed,
            mealOptionId: g.mealOptionId ?? "",
            needsHighChair: g.needsHighChair,
            needsSeparateSeat: g.needsSeparateSeat,
          })),
        }
      : {
          name: "",
          email: "",
          phone: "",
          side: "BOTH",
          tags: "",
          notes: "",
          invitedPartIds: parts.map((p) => p.id),
          guests: [emptyGuest("ADULT")],
        },
  });
  const guests = useFieldArray({ control: form.control, name: "guests" });
  const watchedGuests = form.watch("guests");

  const save = useMutation({
    mutationFn: (v: HouseholdFormValue) => {
      const body: HouseholdInput = {
        name: v.name,
        email: v.email,
        phone: v.phone,
        side: v.side,
        tags: v.tags.split(",").map((s) => s.trim()).filter(Boolean),
        notes: v.notes,
        // Wszystkie zaznaczone = „wszystkie części” (także te dodane później).
        invitedPartIds: v.invitedPartIds.length === parts.length ? [] : v.invitedPartIds,
        guests: v.guests.map((g) => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          type: g.type,
          age: g.type === "CHILD" && g.age !== "" ? Number(g.age) : null,
          plusOneAllowed: g.plusOneAllowed,
          mealOptionId: g.mealOptionId || null,
          needsHighChair: g.needsHighChair,
          needsSeparateSeat: g.needsSeparateSeat,
        })),
      };
      return household
        ? api(`/weddings/${wedding.id}/households/${household.id}`, { method: "PUT", json: body })
        : api(`/weddings/${wedding.id}/households`, { method: "POST", json: body });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("common.saved"));
      onClose();
    },
  });

  const lastNameHint = watchedGuests[0]?.lastName ?? "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{household ? t("guests.editHousehold") : t("guests.addHousehold")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5" noValidate>
          <Field id="h-name" label={t("guests.household")}>
            <Input id="h-name" placeholder={t("guests.householdHint")} {...form.register("name", { required: true })} aria-invalid={!!form.formState.errors.name} />
          </Field>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">{t("guests.people")}</legend>
            {guests.fields.map((field, i) => {
              const g = watchedGuests[i];
              const isChild = g?.type === "CHILD";
              const mealChoices = meals.filter((m) => m.active && (isChild || !m.forChildren));
              return (
                <div key={field.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <NativeSelect className="h-8 w-auto text-sm" {...form.register(`guests.${i}.type`)} aria-label={t("guests.adult")}>
                      <option value="ADULT">{t("guests.adult")}</option>
                      <option value="CHILD">{t("guests.child")}</option>
                    </NativeSelect>
                    {guests.fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => guests.remove(i)}>
                        <X />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder={t("guests.firstName")}
                      aria-label={t("guests.firstName")}
                      aria-invalid={!!form.formState.errors.guests?.[i]?.firstName}
                      {...form.register(`guests.${i}.firstName`, { required: true })}
                    />
                    <Input placeholder={t("guests.lastName")} aria-label={t("guests.lastName")} {...form.register(`guests.${i}.lastName`)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {isChild && (
                      <Input
                        type="number"
                        min={0}
                        max={17}
                        placeholder={t("guests.age")}
                        aria-label={t("guests.age")}
                        {...form.register(`guests.${i}.age`)}
                      />
                    )}
                    <NativeSelect aria-label={t("guests.meal")} {...form.register(`guests.${i}.mealOptionId`)}>
                      <option value="">
                        {t("guests.meal")}: {t("guests.noMeal")}
                      </option>
                      {mealChoices.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {isChild ? (
                      <>
                        <CheckboxField label={t("guests.highChair")} {...form.register(`guests.${i}.needsHighChair`)} />
                        <CheckboxField label={t("guests.separateSeat")} {...form.register(`guests.${i}.needsSeparateSeat`)} />
                      </>
                    ) : (
                      <CheckboxField label={t("guests.plusOneAllowed")} {...form.register(`guests.${i}.plusOneAllowed`)} />
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => guests.append(emptyGuest("ADULT", lastNameHint))}>
                <UserPlus />
                {t("guests.addPerson")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => guests.append(emptyGuest("CHILD", lastNameHint))}>
                <Baby />
                {t("guests.addChild")}
              </Button>
            </div>
          </fieldset>

          {parts.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("guests.invitedParts")}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {parts.map((p) => (
                  <CheckboxField key={p.id} label={p.name} value={p.id} {...form.register("invitedPartIds", { required: true })} />
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="h-email" label={t("guests.email")}>
              <Input id="h-email" type="email" {...form.register("email")} />
            </Field>
            <Field id="h-phone" label={t("guests.phone")}>
              <Input id="h-phone" type="tel" {...form.register("phone")} />
            </Field>
            <Field id="h-side" label={t("guests.side")}>
              <NativeSelect id="h-side" {...form.register("side")}>
                {GUEST_SIDES.map((s, i) => (
                  <option key={s} value={s}>
                    {t(`guests.sides.${s}`, { name: partnerNames[i] ?? "" })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="h-tags" label={t("guests.tags")}>
              <Input id="h-tags" placeholder={t("guests.tagsHint")} {...form.register("tags")} />
            </Field>
          </div>
          <Field id="h-notes" label={t("guests.notes")}>
            <Textarea id="h-notes" rows={2} {...form.register("notes")} />
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

// ─── Prośby o dołączenie ────────────────────────────────────────

function JoinRequests() {
  const { t } = useTranslation();
  const wedding = useWedding();
  const canEdit = useCan("CO_PLANNER");
  const invalidate = useInvalidateGuests();
  const { data } = useQuery({
    queryKey: weddingKeys.joinRequests(wedding.id),
    queryFn: () => api<JoinRequest[]>(`/weddings/${wedding.id}/join-requests`),
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api(`/weddings/${wedding.id}/join-requests/${id}/${action}`, { method: "POST" }),
    onSuccess: (_d, v) => {
      invalidate();
      if (v.action === "approve") toast.success(t("guests.approved"));
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  const pending = data?.filter((r) => r.status === "PENDING") ?? [];
  if (!pending.length) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-800">
      <CardHeader>
        <CardTitle>{t("guests.joinRequests")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {r.firstName} {r.lastName} <span className="font-normal text-muted-foreground">· {r.email}</span>
              </p>
              {r.message && <p className="italic text-muted-foreground">„{r.message}”</p>}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide.mutate({ id: r.id, action: "approve" })} disabled={decide.isPending}>
                  {t("guests.approve")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: r.id, action: "reject" })} disabled={decide.isPending}>
                  {t("guests.reject")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
