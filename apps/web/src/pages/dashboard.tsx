import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CEREMONY_TYPES, LOCALES, createWeddingSchema, suggestSlug, type CreateWeddingInput } from "@wedding/shared";
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

interface WeddingSummary {
  id: string;
  slug: string;
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  ceremonyType: string;
  role: string;
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${isoDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);
  const { data: weddings, isPending } = useQuery({
    queryKey: ["weddings"],
    queryFn: () => api<WeddingSummary[]>("/weddings"),
  });

  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="container space-y-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-semibold">{t("dashboard.title")}</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t("dashboard.create")}
          </Button>
        )}
      </div>

      {creating && <CreateWeddingForm onDone={() => setCreating(false)} />}

      {weddings?.length === 0 && !creating && <p className="text-muted-foreground">{t("dashboard.empty")}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {weddings?.map((w) => {
          const days = daysUntil(w.date);
          return (
            <Card key={w.id}>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">
                  {w.partnerOneName} & {w.partnerTwoName}
                </CardTitle>
                <CardDescription>
                  {new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "long" }).format(new Date(w.date))}
                  {days >= 0 && <> · {t("dashboard.daysLeft", { count: days })}</>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={`/w/${w.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                >
                  /w/{w.slug}
                  <ExternalLink className="size-3.5" />
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CreateWeddingForm({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<CreateWeddingInput>({
    resolver: zodResolver(createWeddingSchema),
    defaultValues: {
      partnerOneName: "",
      partnerTwoName: "",
      date: "",
      ceremonyType: "CHURCH",
      slug: "",
      locale: i18n.resolvedLanguage === "en" ? "en" : "pl",
    },
  });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: (input: CreateWeddingInput) => api("/weddings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["weddings"] });
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "slug_taken") form.setError("slug", { message: t("wedding.slugTaken") });
    },
  });

  const syncSlug = () => {
    if (slugEdited) return;
    const { partnerOneName, partnerTwoName, locale } = form.getValues();
    if (partnerOneName && partnerTwoName) {
      form.setValue("slug", suggestSlug(partnerOneName, partnerTwoName, locale === "en" ? "and" : "i"));
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <Field id="p1" label={t("wedding.partnerOne")}>
            <Input id="p1" aria-invalid={!!errors.partnerOneName} {...form.register("partnerOneName", { onBlur: syncSlug })} />
          </Field>
          <Field id="p2" label={t("wedding.partnerTwo")}>
            <Input id="p2" aria-invalid={!!errors.partnerTwoName} {...form.register("partnerTwoName", { onBlur: syncSlug })} />
          </Field>
          <Field id="date" label={t("wedding.date")}>
            <Input id="date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
          </Field>
          <Field id="ceremony" label={t("wedding.ceremonyType")}>
            <NativeSelect id="ceremony" {...form.register("ceremonyType")}>
              {CEREMONY_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`wedding.ceremony.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="slug" label={t("wedding.slug")} error={errors.slug?.message}>
            <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-sm text-muted-foreground">/w/</span>
              <Input
                id="slug"
                className="border-0 shadow-none focus-visible:ring-0"
                aria-invalid={!!errors.slug}
                {...form.register("slug", { onChange: () => setSlugEdited(true) })}
              />
            </div>
          </Field>
          <Field id="locale" label={t("wedding.locale")}>
            <NativeSelect id="locale" {...form.register("locale")}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {mutation.isError && !(mutation.error instanceof ApiError && mutation.error.code === "slug_taken") && (
            <p className="text-sm text-destructive sm:col-span-2">{t("auth.genericError")}</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {t("wedding.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              ✕
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
