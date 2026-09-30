import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLANS, VENDOR_CATEGORIES, VENDOR_STATUSES, type VendorInput } from "@wedding/shared";
import { Download, ExternalLink, FileText, Mail, Pencil, Phone, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Upsell } from "@/components/upsell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, apiUpload } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Vendor, VendorStatus } from "@/lib/types";
import { useCan, useWedding, weddingKeys } from "./context";

const STATUS_VARIANT: Record<VendorStatus, "default" | "success" | "muted"> = {
  CONSIDERING: "default",
  BOOKED: "success",
  REJECTED: "muted",
};

export function VendorsPage() {
  const wedding = useWedding();
  if (!PLANS[wedding.plan].features.vendors) return <Upsell />;
  return <VendorsView />;
}

function VendorsView() {
  const { t } = useTranslation();
  const wedding = useWedding();
  const canEdit = useCan("CO_PLANNER");
  const { data: vendors } = useQuery({
    queryKey: weddingKeys.vendors(wedding.id),
    queryFn: () => api<Vendor[]>(`/weddings/${wedding.id}/vendors`),
  });
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);

  const filtered = (vendors ?? []).filter((v) => (!category || v.category === category) && (!status || v.status === status));
  const current = editing && editing !== "new" ? (vendors?.find((v) => v.id === editing.id) ?? editing) : editing;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">{t("vendors.title")}</h2>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t("vendors.add")}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <NativeSelect className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("vendors.category")}>
          <option value="">
            {t("vendors.category")}: {t("vendors.filterAll")}
          </option>
          {VENDOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`vendors.categories.${c}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("vendors.status")}>
          <option value="">
            {t("vendors.status")}: {t("vendors.filterAll")}
          </option>
          {VENDOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`vendors.statuses.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {!vendors ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : vendors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t("vendors.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Card key={v.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`vendors.categories.${v.category}`)}</p>
                    <h3 className="truncate font-semibold">{v.name}</h3>
                  </div>
                  <Badge variant={STATUS_VARIANT[v.status]}>{t(`vendors.statuses.${v.status}`)}</Badge>
                </div>
                {v.contactPerson && <p className="text-sm">{v.contactPerson}</p>}
                <div className="flex flex-col gap-1 text-sm">
                  {v.phone && (
                    <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <Phone className="size-3.5" />
                      {v.phone}
                    </a>
                  )}
                  {v.email && (
                    <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1.5 truncate text-primary hover:underline">
                      <Mail className="size-3.5" />
                      {v.email}
                    </a>
                  )}
                  {v.website && (
                    <a href={v.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 truncate text-primary hover:underline">
                      <ExternalLink className="size-3.5" />
                      {new URL(v.website).hostname}
                    </a>
                  )}
                </div>
                {v.notes && <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{v.notes}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  {v.hasContract ? (
                    <a
                      href={`/api/weddings/${wedding.id}/vendors/${v.id}/contract`}
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
                      title={t("vendors.downloadContract")}
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{v.contractName}</span>
                    </a>
                  ) : (
                    <span />
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(v)}>
                      <Pencil />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {current && <VendorDialog vendor={current === "new" ? null : current} onSaved={(v) => setEditing(v)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function VendorDialog({ vendor, onSaved, onClose }: { vendor: Vendor | null; onSaved: (v: Vendor) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: weddingKeys.vendors(wedding.id) });
  const form = useForm<Required<Pick<VendorInput, "category" | "name" | "status">> & Record<"contactPerson" | "phone" | "email" | "website" | "notes", string>>({
    defaultValues: {
      category: (vendor?.category as VendorInput["category"]) ?? "VENUE",
      name: vendor?.name ?? "",
      status: vendor?.status ?? "CONSIDERING",
      contactPerson: vendor?.contactPerson ?? "",
      phone: vendor?.phone ?? "",
      email: vendor?.email ?? "",
      website: vendor?.website ?? "",
      notes: vendor?.notes ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (v: VendorInput) =>
      vendor
        ? api<Vendor>(`/weddings/${wedding.id}/vendors/${vendor.id}`, { method: "PUT", json: v })
        : api<Vendor>(`/weddings/${wedding.id}/vendors`, { method: "POST", json: v }),
    onSuccess: (saved) => {
      void refresh();
      toast.success(t("common.saved"));
      // Nowy usługodawca zostaje otwarty, żeby od razu można było dodać umowę.
      if (vendor) onClose();
      else onSaved(saved);
    },
  });
  const contract = useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) return api(`/weddings/${wedding.id}/vendors/${vendor!.id}/contract`, { method: "DELETE" });
      const data = new FormData();
      data.append("file", file);
      return apiUpload(`/weddings/${wedding.id}/vendors/${vendor!.id}/contract`, data);
    },
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/vendors/${vendor!.id}`, { method: "DELETE" }),
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
          <DialogTitle>{vendor ? t("vendors.edit") : t("vendors.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="v-cat" label={t("vendors.category")}>
              <NativeSelect id="v-cat" {...form.register("category")}>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`vendors.categories.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="v-status" label={t("vendors.status")}>
              <NativeSelect id="v-status" {...form.register("status")}>
                {VENDOR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`vendors.statuses.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id="v-name" label={t("vendors.name")}>
            <Input id="v-name" {...form.register("name", { required: true })} aria-invalid={!!form.formState.errors.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="v-person" label={t("vendors.contactPerson")}>
              <Input id="v-person" {...form.register("contactPerson")} />
            </Field>
            <Field id="v-phone" label={t("vendors.phone")}>
              <Input id="v-phone" type="tel" {...form.register("phone")} />
            </Field>
            <Field id="v-email" label={t("vendors.email")}>
              <Input id="v-email" type="email" {...form.register("email")} />
            </Field>
            <Field id="v-www" label={t("vendors.website")}>
              <Input id="v-www" type="url" placeholder="https://" {...form.register("website")} />
            </Field>
          </div>
          <Field id="v-notes" label={t("vendors.notes")}>
            <Textarea id="v-notes" rows={3} {...form.register("notes")} />
          </Field>

          {vendor && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="text-sm font-medium">{t("vendors.contract")}:</span>
              {vendor.hasContract && <span className="truncate text-sm text-muted-foreground">{vendor.contractName}</span>}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) contract.mutate(f);
                  e.target.value = "";
                }}
              />
              <div className="ml-auto flex gap-1">
                {vendor.hasContract && (
                  <Button asChild type="button" variant="ghost" size="icon" aria-label={t("vendors.downloadContract")}>
                    <a href={`/api/weddings/${wedding.id}/vendors/${vendor.id}/contract`}>
                      <Download />
                    </a>
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={contract.isPending}>
                  <Upload />
                  {t("vendors.uploadContract")}
                </Button>
                {vendor.hasContract && (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("vendors.removeContract")} onClick={() => contract.mutate(null)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          )}

          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex items-center justify-between gap-2">
            {vendor ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => confirm(t("common.confirmDelete")) && remove.mutate()}>
                <Trash2 />
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.close")}
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
