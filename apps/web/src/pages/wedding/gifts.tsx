import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GiftInput } from "@wedding/shared";
import { ExternalLink, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, apiUpload } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import type { AdminGift } from "@/lib/types";
import { useCan, useWedding, useWeddingData, weddingKeys } from "./context";

function useInvalidateGifts() {
  const qc = useQueryClient();
  const { id } = useWedding();
  return () => {
    void qc.invalidateQueries({ queryKey: weddingKeys.gifts(id) });
    void qc.invalidateQueries({ queryKey: weddingKeys.stats(id) });
  };
}

export function GiftsPage() {
  const { t } = useTranslation();
  const canEdit = useCan("CO_PLANNER");
  const [editing, setEditing] = useState<AdminGift | "new" | null>(null);
  const { data: gifts } = useWeddingData<AdminGift[]>("gifts", "/gifts");

  // Po zapisie nowego prezentu otwieramy go w trybie edycji, żeby od razu dodać zdjęcie.
  const current = editing && editing !== "new" ? (gifts?.find((g) => g.id === editing.id) ?? editing) : editing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">{t("gifts.title")}</h2>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t("gifts.add")}
          </Button>
        )}
      </div>

      {!gifts ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : gifts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t("gifts.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gifts.map((g) => (
            <GiftCard key={g.id} gift={g} canEdit={canEdit} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {current && (
        <GiftDialog gift={current === "new" ? null : current} onSaved={(g) => setEditing(g)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function GiftCard({ gift: g, canEdit, onEdit }: { gift: AdminGift; canEdit: boolean; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const invalidate = useInvalidateGifts();
  const lang = i18n.resolvedLanguage;

  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/gifts/${g.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.deleted"));
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const cancelReservation = useMutation({
    mutationFn: (rid: string) => api(`/weddings/${wedding.id}/gifts/${g.id}/reservations/${rid}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const canCancel = useCan("PARTNER");

  const pct = g.isGroupGift && g.targetCents ? Math.min(100, Math.round(((g.pledgedCents ?? 0) / g.targetCents) * 100)) : 0;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="aspect-[4/3] bg-muted">
        {g.imageUrl ? (
          <img src={g.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center font-serif text-4xl text-muted-foreground/40">{g.title.slice(0, 1)}</div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{g.title}</h3>
          {g.hidden && <Badge variant="muted">{t("gifts.hiddenBadge")}</Badge>}
          {g.isGroupGift && <Badge>{t("gifts.groupBadge")}</Badge>}
          <Badge variant={g.available ? "default" : "success"}>{g.available ? t("gifts.free") : t("gifts.reserved")}</Badge>
        </div>
        {g.priceCents != null && <p className="text-sm text-muted-foreground">{formatMoney(g.priceCents, lang)}</p>}
        {g.isGroupGift && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("gifts.collected", { pledged: formatMoney(g.pledgedCents ?? 0, lang), target: formatMoney(g.targetCents, lang) })}
            </p>
          </div>
        )}
        {g.reservations.length > 0 && (
          <ul className="space-y-1 border-t pt-3 text-sm">
            {g.reservations.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <span>
                  {r.name ? t("gifts.reservedBy", { name: r.name }) : t("gifts.reserved")}
                  {r.amountCents != null && <> · {formatMoney(r.amountCents, lang)}</>}
                  {r.email && <span className="block text-xs text-muted-foreground">{r.email}</span>}
                  {r.status === "PENDING" && <span className="block text-xs text-amber-700 dark:text-amber-400">{t("gifts.pendingConfirmation")}</span>}
                </span>
                {canCancel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title={t("gifts.cancelReservation")}
                    aria-label={t("gifts.cancelReservation")}
                    onClick={() => confirm(t("gifts.cancelReservation") + "?") && cancelReservation.mutate(r.id)}
                  >
                    <Trash2 className="!size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center gap-1 pt-2">
          {g.url && (
            <Button asChild variant="ghost" size="icon" title={g.url} aria-label={t("publicPage.goToShop")}>
              <a href={g.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink />
              </a>
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")} onClick={onEdit}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                title={t("common.delete")}
                onClick={() => confirm(t("common.confirmDelete")) && remove.mutate()}
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

interface GiftFormValue {
  title: string;
  description: string;
  url: string;
  price: string;
  isGroupGift: boolean;
  target: string;
  hidden: boolean;
}

function GiftDialog({ gift, onSaved, onClose }: { gift: AdminGift | null; onSaved: (g: AdminGift) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const invalidate = useInvalidateGifts();
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<GiftFormValue>({
    defaultValues: {
      title: gift?.title ?? "",
      description: gift?.description ?? "",
      url: gift?.url ?? "",
      price: gift?.priceCents != null ? String(gift.priceCents / 100) : "",
      isGroupGift: gift?.isGroupGift ?? false,
      target: gift?.targetCents != null ? String(gift.targetCents / 100) : "",
      hidden: gift?.hidden ?? false,
    },
  });
  const isGroup = form.watch("isGroupGift");

  const save = useMutation({
    mutationFn: (v: GiftFormValue) => {
      const body: GiftInput = { ...v, order: gift?.order ?? 0 };
      return gift
        ? api<AdminGift>(`/weddings/${wedding.id}/gifts/${gift.id}`, { method: "PUT", json: body })
        : api<AdminGift>(`/weddings/${wedding.id}/gifts`, { method: "POST", json: body });
    },
    onSuccess: (saved) => {
      invalidate();
      toast.success(t("common.saved"));
      if (gift) onClose();
      else onSaved(saved);
    },
  });

  const image = useMutation({
    mutationFn: async (file: File | null) => {
      if (!gift) throw new Error("no gift");
      if (!file) return api<AdminGift>(`/weddings/${wedding.id}/gifts/${gift.id}/image`, { method: "DELETE" });
      const data = new FormData();
      data.append("image", file);
      return apiUpload<AdminGift>(`/weddings/${wedding.id}/gifts/${gift.id}/image`, data);
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gift ? t("gifts.edit") : t("gifts.add")}</DialogTitle>
          {!gift && <DialogDescription>{t("gifts.saveFirst")}</DialogDescription>}
        </DialogHeader>

        {gift && (
          <div className="flex items-center gap-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {gift.imageUrl && <img src={gift.imageUrl} alt="" className="size-full object-cover" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) image.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={image.isPending}>
                <ImagePlus />
                {t("gifts.uploadImage")}
              </Button>
              {gift.imageUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => image.mutate(null)} disabled={image.isPending}>
                  {t("gifts.removeImage")}
                </Button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field id="g-title" label={t("gifts.name")}>
            <Input id="g-title" {...form.register("title", { required: true })} aria-invalid={!!form.formState.errors.title} />
          </Field>
          <Field id="g-desc" label={t("gifts.description")}>
            <Textarea id="g-desc" rows={2} {...form.register("description")} />
          </Field>
          <Field id="g-url" label={t("gifts.url")}>
            <Input id="g-url" type="url" placeholder="https://" {...form.register("url")} />
          </Field>
          <Field id="g-price" label={t("gifts.price")}>
            <Input id="g-price" inputMode="decimal" {...form.register("price")} />
          </Field>
          <CheckboxField label={t("gifts.isGroup")} {...form.register("isGroupGift")} />
          {isGroup && (
            <Field id="g-target" label={t("gifts.target")}>
              <Input id="g-target" inputMode="decimal" {...form.register("target", { required: isGroup })} />
            </Field>
          )}
          <CheckboxField label={t("gifts.hidden")} {...form.register("hidden")} />

          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.close")}
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
