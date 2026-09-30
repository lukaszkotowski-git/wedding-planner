import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, CheckCircle2, ExternalLink, Gift as GiftIcon, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ConsentCheckbox } from "@/components/consent";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { daysUntil, formatDate, formatMoney, formatTime } from "@/lib/format";
import type { EventPart, Gift } from "@/lib/types";
import { useGuestLocale } from "./use-guest-locale";

export interface PublicWedding {
  slug: string;
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  locale: string;
  welcomeMessage: string | null;
  rsvpMode: "DEDICATED" | "OPEN" | "BOTH";
  rsvpDeadline: string | null;
  rsvpOpen: boolean;
  giftsIntro: string | null;
  cashGiftInfo: string | null;
  showBranding: boolean;
  eventParts: EventPart[];
  gifts: Gift[];
}

export const publicWeddingKey = (slug: string) => ["public-wedding", slug] as const;

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-3xl scroll-mt-8 px-4 py-14">
      <h2 className="mb-8 text-center font-serif text-4xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PublicWeddingPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const { data: w, isPending, isError } = useQuery({
    queryKey: publicWeddingKey(slug),
    queryFn: () => api<PublicWedding>(`/public/weddings/${encodeURIComponent(slug)}`),
  });
  useGuestLocale(w?.locale);
  const lang = i18n.resolvedLanguage;

  if (isPending) return <p className="container py-16 text-muted-foreground">{t("common.loading")}</p>;
  if (isError || !w) return <p className="container py-16 text-center">{t("public.notFound")}</p>;

  const days = daysUntil(w.date);
  const showGifts = w.gifts.length > 0 || w.cashGiftInfo;

  return (
    <div className="min-h-screen">
      <header className="flex min-h-[60svh] flex-col items-center justify-center gap-5 bg-gradient-to-b from-secondary/60 to-background px-4 py-16 text-center sm:min-h-[75vh]">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{t("public.invite")}</p>
        {/* Spacje między imionami pozwalają złamać linię na wąskim ekranie (długie imiona nie wystają). */}
        <h1 className="max-w-full font-serif text-5xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-8xl sm:leading-none">
          {w.partnerOneName} <span className="text-primary">&</span> {w.partnerTwoName}
        </h1>
        <p className="text-lg sm:text-xl">{formatDate(w.date, lang, "full")}</p>
        {days > 0 && <p className="text-sm text-muted-foreground">{t("dashboard.daysLeft", { count: days })}</p>}
        <nav className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href="#rsvp">{t("publicPage.rsvpTitle")}</a>
          </Button>
          {showGifts && (
            <Button asChild variant="outline">
              <a href="#gifts">{t("publicPage.giftsTitle")}</a>
            </Button>
          )}
        </nav>
      </header>

      {w.welcomeMessage && (
        <section className="mx-auto max-w-2xl whitespace-pre-line px-4 pt-14 text-center text-lg leading-relaxed">{w.welcomeMessage}</section>
      )}

      {w.eventParts.length > 0 && (
        <Section title={t("publicPage.schedule")}>
          <ol className="relative mx-auto w-fit max-w-full space-y-8 border-l border-primary/30 pl-8">
            {w.eventParts.map((p) => (
              <li key={p.id} className="relative">
                <span className="absolute -left-[41px] top-1 flex size-5 items-center justify-center rounded-full border-2 border-primary bg-background" />
                <p className="font-serif text-2xl font-semibold">
                  <time dateTime={p.startsAt}>{formatTime(p.startsAt, lang)}</time>
                  <span className="ml-3">{p.name}</span>
                </p>
                {(p.locationName || p.address) && (
                  <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="mt-1 size-4 shrink-0" />
                    <span>
                      {p.locationName && <span className="block text-foreground">{p.locationName}</span>}
                      {p.address}
                    </span>
                  </p>
                )}
                {p.notes && <p className="mt-2 whitespace-pre-line text-sm">{p.notes}</p>}
                {p.mapUrl && (
                  <a
                    href={p.mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t("publicPage.map")}
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section id="rsvp" title={t("publicPage.rsvpTitle")}>
        <div className="mx-auto max-w-md space-y-4 text-center">
          {!w.rsvpOpen ? (
            <p>{t("publicPage.rsvpClosed")}</p>
          ) : (
            <>
              {w.rsvpDeadline && <p className="text-muted-foreground">{t("publicPage.rsvpDeadline", { date: formatDate(w.rsvpDeadline, lang) })}</p>}
              {w.rsvpMode === "DEDICATED" ? (
                <p className="flex items-center justify-center gap-2">
                  <CalendarHeart className="size-5 text-primary" />
                  {t("publicPage.rsvpDedicatedHint")}
                </p>
              ) : (
                <RsvpSearch slug={w.slug} />
              )}
            </>
          )}
        </div>
      </Section>

      {showGifts && (
        <Section id="gifts" title={t("publicPage.giftsTitle")}>
          {w.giftsIntro && <p className="mx-auto mb-8 max-w-xl whitespace-pre-line text-center text-muted-foreground">{w.giftsIntro}</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            {w.gifts.map((g) => (
              <PublicGiftCard key={g.id} gift={g} slug={w.slug} />
            ))}
          </div>
          {w.cashGiftInfo && (
            <div className="mx-auto mt-10 max-w-xl rounded-xl border bg-card p-6 text-center">
              <p className="mb-2 flex items-center justify-center gap-2 font-serif text-2xl font-semibold">
                <GiftIcon className="size-5 text-primary" />
                {t("publicPage.cashTitle")}
              </p>
              <p className="whitespace-pre-line">{w.cashGiftInfo}</p>
            </div>
          )}
        </Section>
      )}

      <footer className="space-x-4 border-t py-8 text-center text-xs text-muted-foreground">
        {w.showBranding && (
          <Link href="~/" className="hover:text-foreground">
            {t("publicPage.madeWith")}
          </Link>
        )}
        <Link href="~/privacy" className="hover:text-foreground">
          {t("legal.privacy")}
        </Link>
      </footer>
    </div>
  );
}

// ─── Wyszukiwanie zaproszenia (tryb otwarty) ────────────────────

function RsvpSearch({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const search = useMutation({
    mutationFn: () =>
      api<{ token: string; label: string }[]>(`/public/weddings/${slug}/rsvp-search`, { method: "POST", json: names }),
  });
  const [joining, setJoining] = useState(false);

  return (
    <div className="space-y-4 text-left">
      <p className="text-center text-muted-foreground">{t("publicPage.searchIntro")}</p>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setJoining(false);
          search.mutate();
        }}
      >
        <Input
          required
          minLength={2}
          placeholder={t("guests.firstName")}
          aria-label={t("guests.firstName")}
          autoComplete="given-name"
          value={names.firstName}
          onChange={(e) => setNames({ ...names, firstName: e.target.value })}
        />
        <Input
          required
          minLength={2}
          placeholder={t("guests.lastName")}
          aria-label={t("guests.lastName")}
          autoComplete="family-name"
          value={names.lastName}
          onChange={(e) => setNames({ ...names, lastName: e.target.value })}
        />
        <Button type="submit" disabled={search.isPending}>
          <Search />
          <span className="sm:sr-only">{t("publicPage.find")}</span>
        </Button>
      </form>

      {search.isError && <p className="text-sm text-destructive">{errorMessage(t, search.error)}</p>}
      {search.data && search.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("publicPage.results")}</p>
          {search.data.map((r) => (
            <Link
              key={r.token}
              href={`/r/${r.token}`}
              className="block rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary hover:bg-accent"
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}
      {search.data && search.data.length === 0 && (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">{t("publicPage.noResults")}</p>
          {!joining && (
            <Button variant="outline" onClick={() => setJoining(true)}>
              {t("publicPage.joinTitle")}
            </Button>
          )}
        </div>
      )}
      {joining && <JoinRequestForm slug={slug} initial={names} />}
    </div>
  );
}

function JoinRequestForm({ slug, initial }: { slug: string; initial: { firstName: string; lastName: string } }) {
  const { t, i18n } = useTranslation();
  const form = useForm({ defaultValues: { ...initial, email: "", message: "", consent: false } });
  const send = useMutation({
    mutationFn: (v: typeof initial & { email: string; message: string; consent: boolean }) =>
      api(`/public/weddings/${slug}/join-requests`, { method: "POST", json: { ...v, locale: i18n.resolvedLanguage } }),
  });

  if (send.isSuccess) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg border bg-card p-4">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
        {t("publicPage.joinSent")}
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3 rounded-lg border bg-card p-4">
      <p className="font-serif text-xl font-semibold">{t("publicPage.joinTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("publicPage.joinIntro")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input aria-label={t("guests.firstName")} required {...form.register("firstName", { required: true })} />
        <Input aria-label={t("guests.lastName")} required {...form.register("lastName", { required: true })} />
      </div>
      <Field id="jr-email" label={t("publicPage.yourEmail")}>
        <Input id="jr-email" type="email" required autoComplete="email" {...form.register("email", { required: true })} />
      </Field>
      <Field id="jr-msg" label={t("publicPage.joinMessage")}>
        <Textarea id="jr-msg" rows={2} {...form.register("message")} />
      </Field>
      <ConsentCheckbox kind="join" {...form.register("consent", { required: true })} />
      {send.isError && <p className="text-sm text-destructive">{errorMessage(t, send.error)}</p>}
      <Button type="submit" disabled={send.isPending}>
        {t("publicPage.joinSend")}
      </Button>
    </form>
  );
}

// ─── Prezenty ───────────────────────────────────────────────────

function PublicGiftCard({ gift: g, slug }: { gift: Gift; slug: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const [open, setOpen] = useState(false);
  const pct = g.isGroupGift && g.targetCents ? Math.min(100, Math.round(((g.pledgedCents ?? 0) / g.targetCents) * 100)) : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      {g.imageUrl && <img src={g.imageUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-2xl font-semibold leading-tight">{g.title}</h3>
          {!g.available && <Badge variant="success">{t("publicPage.reservedBadge")}</Badge>}
        </div>
        {g.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{g.description}</p>}
        {g.priceCents != null && !g.isGroupGift && <p className="text-sm">{t("publicPage.price", { price: formatMoney(g.priceCents, lang) })}</p>}
        {g.isGroupGift && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("publicPage.collected", { pledged: formatMoney(g.pledgedCents ?? 0, lang), target: formatMoney(g.targetCents, lang) })}
            </p>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {g.available && <Button onClick={() => setOpen(true)}>{t("publicPage.reserve")}</Button>}
          {g.url && (
            <Button asChild variant="outline">
              <a href={g.url} target="_blank" rel="noreferrer noopener">
                {t("publicPage.goToShop")}
                <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </div>
      {open && <ReserveDialog gift={g} slug={slug} onClose={() => setOpen(false)} />}
    </article>
  );
}

function ReserveDialog({ gift, slug, onClose }: { gift: Gift; slug: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const form = useForm({ defaultValues: { name: "", email: "", amount: "", consent: false } });
  const reserve = useMutation({
    mutationFn: (v: { name: string; email: string; amount: string; consent: boolean }) =>
      api(`/public/weddings/${slug}/gifts/${gift.id}/reserve`, {
        method: "POST",
        json: { ...v, amount: gift.isGroupGift ? v.amount : null, locale: i18n.resolvedLanguage },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: publicWeddingKey(slug) }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("publicPage.reserveTitle", { gift: gift.title })}</DialogTitle>
          <DialogDescription>{t("publicPage.reserveIntro")}</DialogDescription>
        </DialogHeader>
        {reserve.isSuccess ? (
          <div className="space-y-4">
            <p role="status" className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              {t("publicPage.reserveSent", { email: form.getValues("email") })}
            </p>
            <Button onClick={onClose}>{t("common.close")}</Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((v) => reserve.mutate(v))} className="space-y-4">
            <Field id="r-name" label={t("publicPage.yourName")}>
              <Input id="r-name" required autoComplete="name" {...form.register("name", { required: true })} />
            </Field>
            <Field id="r-email" label={t("publicPage.yourEmail")}>
              <Input id="r-email" type="email" required autoComplete="email" {...form.register("email", { required: true })} />
            </Field>
            {gift.isGroupGift && (
              <Field id="r-amount" label={t("publicPage.amount")}>
                <Input id="r-amount" inputMode="decimal" required {...form.register("amount", { required: true })} />
                {gift.remainingCents != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("publicPage.remaining", { remaining: formatMoney(gift.remainingCents, i18n.resolvedLanguage) })}
                  </p>
                )}
              </Field>
            )}
            <ConsentCheckbox kind="gift" {...form.register("consent", { required: true })} />
            {reserve.isError && <p className="text-sm text-destructive">{errorMessage(t, reserve.error)}</p>}
            <Button type="submit" className="w-full" disabled={reserve.isPending}>
              {t("publicPage.reserveSubmit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
