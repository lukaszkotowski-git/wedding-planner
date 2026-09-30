import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RsvpSubmitInput } from "@wedding/shared";
import { CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ConsentCheckbox } from "@/components/consent";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import type { EventPart } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGuestLocale } from "./use-guest-locale";

interface RsvpGuest {
  id: string;
  firstName: string;
  lastName: string;
  type: "ADULT" | "CHILD";
  age: number | null;
  plusOneAllowed: boolean;
  mealOptionId: string | null;
  dietNotes: string | null;
  attendance: Record<string, boolean>;
}

interface RsvpData {
  wedding: { slug: string; partnerOneName: string; partnerTwoName: string; date: string; locale: string; rsvpDeadline: string | null; rsvpOpen: boolean };
  household: {
    name: string;
    email: string | null;
    locked: boolean;
    needsAccommodation: boolean | null;
    needsTransport: boolean | null;
    messageToCouple: string | null;
  };
  eventParts: EventPart[];
  mealOptions: { id: string; name: string; description: string | null; forChildren: boolean }[];
  guests: (RsvpGuest & { plusOne: RsvpGuest | null })[];
}

interface GuestAnswer {
  attendance: Record<string, boolean | undefined>;
  mealOptionId: string;
  dietNotes: string;
  bringPlusOne: boolean;
  plusOne: { firstName: string; lastName: string; mealOptionId: string; dietNotes: string };
}

export function RsvpPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ["rsvp", token],
    queryFn: () => api<RsvpData>(`/public/rsvp/${encodeURIComponent(token)}`),
  });
  useGuestLocale(data?.wedding.locale);

  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (isError || !data) return <p className="container py-16 text-center">{t("public.notFound")}</p>;

  const w = data.wedding;
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:py-16">
      <header className="space-y-2 text-center">
        <Link href="/" className="font-serif text-4xl font-semibold hover:text-primary sm:text-5xl">
          {w.partnerOneName} & {w.partnerTwoName}
        </Link>
        <p className="text-muted-foreground">{formatDate(w.date, i18n.resolvedLanguage, "full")}</p>
        <p className="pt-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">{t("rsvp.for", { name: data.household.name })}</p>
      </header>
      {data.household.locked ? (
        <LockedSummary data={data} />
      ) : !w.rsvpOpen ? (
        <Card>
          <CardContent className="p-6 text-center">{t("publicPage.rsvpClosed")}</CardContent>
        </Card>
      ) : (
        <RsvpForm token={token} data={data} />
      )}
    </main>
  );
}

function LockedSummary({ data }: { data: RsvpData }) {
  const { t } = useTranslation();
  const meal = (id: string | null) => data.mealOptions.find((m) => m.id === id)?.name;
  const people = data.guests.flatMap((g) => [g, ...(g.plusOne ? [g.plusOne] : [])]);
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <p className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {t("rsvp.lockedInfo")}
        </p>
        <ul className="space-y-2 border-t pt-4 text-sm">
          {people.map((g) => {
            const parts = data.eventParts.filter((p) => g.attendance[p.id]);
            return (
              <li key={g.id}>
                <span className="font-medium">
                  {g.firstName} {g.lastName}
                </span>
                {": "}
                {parts.length ? parts.map((p) => p.name).join(", ") : t("rsvp.wontAttend")}
                {meal(g.mealOptionId) && <span className="text-muted-foreground"> · {meal(g.mealOptionId)}</span>}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function RsvpForm({ token, data }: { token: string; data: RsvpData }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n.resolvedLanguage;
  const parts = data.eventParts;

  const [answers, setAnswers] = useState<Record<string, GuestAnswer>>(() =>
    Object.fromEntries(
      data.guests.map((g) => [
        g.id,
        {
          attendance: Object.fromEntries(parts.map((p) => [p.id, g.attendance[p.id]])),
          mealOptionId: g.mealOptionId ?? "",
          dietNotes: g.dietNotes ?? "",
          bringPlusOne: !!g.plusOne,
          plusOne: {
            firstName: g.plusOne?.firstName ?? "",
            lastName: g.plusOne?.lastName ?? "",
            mealOptionId: g.plusOne?.mealOptionId ?? "",
            dietNotes: g.plusOne?.dietNotes ?? "",
          },
        },
      ]),
    ),
  );
  const [extra, setExtra] = useState({
    email: data.household.email ?? "",
    needsAccommodation: !!data.household.needsAccommodation,
    needsTransport: !!data.household.needsTransport,
    messageToCouple: data.household.messageToCouple ?? "",
    consent: false,
  });
  const [showIncomplete, setShowIncomplete] = useState(false);

  const update = (guestId: string, patch: Partial<GuestAnswer>) =>
    setAnswers((a) => ({ ...a, [guestId]: { ...a[guestId]!, ...patch } }));

  const submit = useMutation({
    mutationFn: () => {
      const body: RsvpSubmitInput = {
        guests: data.guests.map((g) => {
          const a = answers[g.id]!;
          const attending = Object.values(a.attendance).some(Boolean);
          return {
            guestId: g.id,
            attendance: Object.fromEntries(parts.map((p) => [p.id, !!a.attendance[p.id]])),
            mealOptionId: attending ? a.mealOptionId || null : null,
            dietNotes: attending ? a.dietNotes : null,
            plusOne: attending && g.plusOneAllowed && a.bringPlusOne ? { ...a.plusOne, mealOptionId: a.plusOne.mealOptionId || null } : null,
          };
        }),
        email: extra.email,
        needsAccommodation: extra.needsAccommodation,
        needsTransport: extra.needsTransport,
        messageToCouple: extra.messageToCouple,
        consent: extra.consent as true,
      };
      return api(`/public/rsvp/${encodeURIComponent(token)}?lang=${lang}`, { method: "POST", json: body });
    },
    onSuccess: () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      void qc.invalidateQueries({ queryKey: ["rsvp", token] });
    },
  });

  if (submit.isSuccess) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="font-serif text-2xl font-semibold">{t("rsvp.thanks")}</p>
        </CardContent>
      </Card>
    );
  }

  const incomplete = data.guests.some((g) => parts.some((p) => answers[g.id]!.attendance[p.id] === undefined));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (incomplete) return setShowIncomplete(true);
        submit.mutate();
      }}
    >
      {data.guests.map((g) => {
        const a = answers[g.id]!;
        const attending = Object.values(a.attendance).some(Boolean);
        const meals = data.mealOptions.filter((m) => g.type === "CHILD" || !m.forChildren);
        const adultMeals = data.mealOptions.filter((m) => !m.forChildren);
        return (
          <Card key={g.id}>
            <CardContent className="space-y-4 p-5">
              <p className="font-serif text-2xl font-semibold">
                {g.firstName} {g.lastName}
                {g.type === "CHILD" && g.age != null && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">({t("rsvp.childAge", { age: g.age })})</span>
                )}
              </p>

              {parts.map((p) => (
                <fieldset key={p.id} className="space-y-2">
                  <legend className="text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground"> · {formatTime(p.startsAt, lang)}</span>
                  </legend>
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2",
                      showIncomplete && a.attendance[p.id] === undefined && "rounded-lg ring-2 ring-destructive ring-offset-2 ring-offset-background",
                    )}
                  >
                    {[true, false].map((value) => (
                      <label
                        key={String(value)}
                        className={cn(
                          "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`${g.id}-${p.id}`}
                          checked={a.attendance[p.id] === value}
                          onChange={() => update(g.id, { attendance: { ...a.attendance, [p.id]: value } })}
                        />
                        {value ? t("rsvp.willAttend") : t("rsvp.wontAttend")}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              {attending && meals.length > 0 && (
                <Field id={`meal-${g.id}`} label={t("rsvp.meal")}>
                  <NativeSelect
                    id={`meal-${g.id}`}
                    required
                    value={a.mealOptionId}
                    onChange={(e) => update(g.id, { mealOptionId: e.target.value })}
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {meals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.description ? ` (${m.description})` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {attending && (
                <Field id={`diet-${g.id}`} label={t("rsvp.diet")}>
                  <Input
                    id={`diet-${g.id}`}
                    placeholder={t("rsvp.dietPlaceholder")}
                    value={a.dietNotes}
                    onChange={(e) => update(g.id, { dietNotes: e.target.value })}
                  />
                </Field>
              )}

              {attending && g.plusOneAllowed && (
                <div className="space-y-3 rounded-lg bg-secondary/50 p-4">
                  <CheckboxField
                    label={t("rsvp.bringPlusOne")}
                    checked={a.bringPlusOne}
                    onChange={(e) => update(g.id, { bringPlusOne: e.target.checked })}
                  />
                  {a.bringPlusOne && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          required
                          placeholder={t("rsvp.plusOneName")}
                          aria-label={t("rsvp.plusOneName")}
                          value={a.plusOne.firstName}
                          onChange={(e) => update(g.id, { plusOne: { ...a.plusOne, firstName: e.target.value } })}
                        />
                        <Input
                          required
                          placeholder={t("rsvp.plusOneLastName")}
                          aria-label={t("rsvp.plusOneLastName")}
                          value={a.plusOne.lastName}
                          onChange={(e) => update(g.id, { plusOne: { ...a.plusOne, lastName: e.target.value } })}
                        />
                      </div>
                      {adultMeals.length > 0 && (
                        <NativeSelect
                          required
                          aria-label={t("rsvp.meal")}
                          value={a.plusOne.mealOptionId}
                          onChange={(e) => update(g.id, { plusOne: { ...a.plusOne, mealOptionId: e.target.value } })}
                        >
                          <option value="" disabled>
                            {t("rsvp.meal")}
                          </option>
                          {adultMeals.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                      <Input
                        placeholder={t("rsvp.dietPlaceholder")}
                        aria-label={t("rsvp.diet")}
                        value={a.plusOne.dietNotes}
                        onChange={(e) => update(g.id, { plusOne: { ...a.plusOne, dietNotes: e.target.value } })}
                      />
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="space-y-4 p-5">
          <CheckboxField
            label={t("rsvp.accommodation")}
            checked={extra.needsAccommodation}
            onChange={(e) => setExtra({ ...extra, needsAccommodation: e.target.checked })}
          />
          <CheckboxField
            label={t("rsvp.transport")}
            checked={extra.needsTransport}
            onChange={(e) => setExtra({ ...extra, needsTransport: e.target.checked })}
          />
          <Field id="rsvp-msg" label={t("rsvp.message")}>
            <Textarea id="rsvp-msg" rows={3} value={extra.messageToCouple} onChange={(e) => setExtra({ ...extra, messageToCouple: e.target.value })} />
          </Field>
          <Field id="rsvp-email" label={t("rsvp.email")}>
            <Input id="rsvp-email" type="email" autoComplete="email" value={extra.email} onChange={(e) => setExtra({ ...extra, email: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t("rsvp.emailHint")}</p>
          </Field>
          <ConsentCheckbox kind="rsvp" checked={extra.consent} onChange={(e) => setExtra({ ...extra, consent: e.target.checked })} />
        </CardContent>
      </Card>

      {showIncomplete && incomplete && <p className="text-sm text-destructive">{t("rsvp.answerAll")}</p>}
      {submit.isError && <p className="text-sm text-destructive">{errorMessage(t, submit.error)}</p>}
      <div className="space-y-2 text-center">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submit.isPending}>
          {t("rsvp.submit")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("rsvp.finalNote")}</p>
      </div>
    </form>
  );
}
