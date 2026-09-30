import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLANS, hasRole, type ExpenseInput } from "@wedding/shared";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Upsell } from "@/components/upsell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import type { Budget, BudgetCategory, BudgetExpense, Vendor, Wedding } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWedding, weddingKeys } from "./context";

const zl = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
const todayIso = () => new Date().toISOString().slice(0, 10);

export function BudgetPage() {
  const wedding = useWedding();
  if (!PLANS[wedding.plan].features.budget) return <Upsell />;
  if (!hasRole(wedding.role, "PARTNER")) return <Upsell reason="role" />;
  return <BudgetView />;
}

function useInvalidateBudget() {
  const qc = useQueryClient();
  const { id } = useWedding();
  return () => {
    void qc.invalidateQueries({ queryKey: weddingKeys.budget(id) });
    void qc.invalidateQueries({ queryKey: ["wedding", id, "calendar"] });
  };
}

/** Zapis kosztu z ratami (API przyjmuje złote; koszt edytujemy zawsze w całości). */
function expenseBody(e: BudgetExpense, categoryId: string, paymentsOverride?: BudgetExpense["payments"]): ExpenseInput {
  return {
    categoryId,
    vendorId: e.vendor?.id ?? null,
    title: e.title,
    amount: e.amountCents / 100,
    notes: e.notes,
    payments: (paymentsOverride ?? e.payments).map((p) => ({
      id: p.id,
      amount: p.amountCents / 100,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      note: p.note,
    })),
  };
}

function BudgetView() {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const lang = i18n.resolvedLanguage;
  const invalidate = useInvalidateBudget();
  const { data: budget } = useQuery({
    queryKey: weddingKeys.budget(wedding.id),
    queryFn: () => api<Budget>(`/weddings/${wedding.id}/budget`),
  });
  const [expense, setExpense] = useState<{ expense: BudgetExpense | null; categoryId: string } | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const addDefaults = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/budget/categories/defaults`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const addCategory = useMutation({
    mutationFn: () =>
      api(`/weddings/${wedding.id}/budget/categories`, { method: "POST", json: { name: newCategory, order: budget?.categories.length ?? 0 } }),
    onSuccess: () => {
      setNewCategory("");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const markPaid = useMutation({
    mutationFn: (paymentId: string) => {
      for (const c of budget!.categories) {
        for (const e of c.expenses) {
          if (e.payments.some((p) => p.id === paymentId)) {
            const payments = e.payments.map((p) => (p.id === paymentId ? { ...p, paidAt: todayIso() } : p));
            return api(`/weddings/${wedding.id}/budget/expenses/${e.id}`, { method: "PUT", json: expenseBody(e, c.id, payments) });
          }
        }
      }
      throw new Error("payment not found");
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  if (!budget) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  const { totals } = budget;
  const toPay = totals.committedCents - totals.paidCents;
  const planLeft = totals.plannedCents - totals.committedCents;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("budget.planned"), value: totals.plannedCents },
          { label: t("budget.committed"), value: totals.committedCents, hint: planLeft >= 0 ? `${t("budget.remainingPlan")}: ${formatMoney(planLeft, lang)}` : `${t("budget.overPlan")}: ${formatMoney(-planLeft, lang)}`, warn: planLeft < 0 },
          { label: t("budget.paid"), value: totals.paidCents },
          { label: t("budget.toPay"), value: toPay },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="space-y-1 p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-serif text-3xl font-semibold tabular-nums">{formatMoney(s.value, lang) || "0 zł"}</p>
              {s.hint && <p className={cn("text-xs text-muted-foreground", s.warn && "font-medium text-destructive")}>{s.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <h2 className="font-serif text-2xl font-semibold">{t("budget.categories")}</h2>
          {budget.categories.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">{t("budget.empty")}</p>
                <Button onClick={() => addDefaults.mutate()} disabled={addDefaults.isPending}>
                  {t("budget.defaults")}
                </Button>
              </CardContent>
            </Card>
          )}
          {budget.categories.map((c) => (
            <CategoryRow key={c.id} category={c} onAddExpense={() => setExpense({ expense: null, categoryId: c.id })} onEditExpense={(e) => setExpense({ expense: e, categoryId: c.id })} />
          ))}
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategory.trim()) addCategory.mutate();
            }}
          >
            <Input placeholder={t("budget.categoryName")} aria-label={t("budget.categoryName")} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <Button type="submit" variant="outline" disabled={addCategory.isPending}>
              <Plus />
              {t("budget.addCategory")}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <CateringCard budget={budget} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("budget.upcomingPayments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {budget.upcomingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("budget.noPayments")}</p>
              ) : (
                <ul className="space-y-3">
                  {budget.upcomingPayments.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {p.expenseTitle}: {formatMoney(p.amountCents, lang)}
                        </span>
                        <span className={cn("block text-xs text-muted-foreground", p.overdue && "font-medium text-destructive")}>
                          {p.dueDate ? formatDate(p.dueDate, lang, "medium") : "—"}
                          {p.overdue && ` · ${t("budget.overdue")}`}
                          {p.note && ` · ${p.note}`}
                        </span>
                      </span>
                      <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => markPaid.mutate(p.id)} disabled={markPaid.isPending}>
                        <Check className="!size-3.5" />
                        {t("budget.markPaid")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {expense && (
        <ExpenseDialog
          expense={expense.expense}
          categoryId={expense.categoryId}
          categories={budget.categories}
          onClose={() => setExpense(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function CategoryRow({
  category: c,
  onAddExpense,
  onEditExpense,
}: {
  category: BudgetCategory;
  onAddExpense: () => void;
  onEditExpense: (e: BudgetExpense) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const wedding = useWedding();
  const invalidate = useInvalidateBudget();
  const [open, setOpen] = useState(false);
  const [planned, setPlanned] = useState(zl(c.plannedCents));

  const update = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/budget/categories/${c.id}`, { method: "PUT", json: { name: c.name, planned: planned || 0, order: c.order } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/budget/categories/${c.id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  const over = c.plannedCents > 0 && c.committedCents > c.plannedCents;
  const pct = c.plannedCents > 0 ? Math.min(100, Math.round((c.committedCents / c.plannedCents) * 100)) : c.committedCents > 0 ? 100 : 0;
  const paidPct = c.committedCents > 0 ? Math.round((c.paidCents / c.committedCents) * pct) : 0;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <button type="button" className="flex min-w-40 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
            <span className="font-medium">{c.name}</span>
            {c.expenses.length > 0 && <Badge variant="muted">{c.expenses.length}</Badge>}
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="tabular-nums">{formatMoney(c.committedCents, lang) || "0 zł"}</span>
            <span className="text-muted-foreground">/</span>
            <Input
              className="h-8 w-28 text-right tabular-nums"
              inputMode="decimal"
              aria-label={`${t("budget.planned")}: ${c.name}`}
              placeholder={t("budget.planned")}
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
              onBlur={() => planned !== zl(c.plannedCents) && update.mutate()}
            />
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("relative h-full rounded-full", over ? "bg-destructive" : "bg-primary/40")} style={{ width: `${pct}%` }}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct ? (paidPct / pct) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
        {open && (
          <div className="space-y-3 border-t p-4">
            {c.expenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.title}
                    {e.vendor && <span className="font-normal text-muted-foreground"> · {e.vendor.name}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(e.amountCents, lang)} · {t("budget.paid")}: {formatMoney(e.paidCents, lang) || "0 zł"}
                    {e.payments.some((p) => p.overdue) && <span className="font-medium text-destructive"> · {t("budget.overdue")}</span>}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t("common.edit")} onClick={() => onEditExpense(e)}>
                  <Pencil className="!size-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={onAddExpense}>
                <Plus />
                {t("budget.addExpense")}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(t("common.confirmDelete")) && remove.mutate()}>
                <Trash2 />
                {t("common.delete")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CateringCard({ budget }: { budget: Budget }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const wedding = useWedding();
  const qc = useQueryClient();
  const [price, setPrice] = useState(zl(wedding.platePriceCents));
  const save = useMutation({
    mutationFn: () =>
      api<Wedding>(`/weddings/${wedding.id}`, {
        method: "PATCH",
        json: {
          partnerOneName: wedding.partnerOneName,
          partnerTwoName: wedding.partnerTwoName,
          date: wedding.date,
          ceremonyType: wedding.ceremonyType,
          slug: wedding.slug,
          locale: wedding.locale,
          rsvpMode: wedding.rsvpMode,
          rsvpDeadline: wedding.rsvpDeadline,
          welcomeMessage: wedding.welcomeMessage,
          giftsIntro: wedding.giftsIntro,
          cashGiftInfo: wedding.cashGiftInfo,
          platePrice: price,
        },
      }),
    onSuccess: (w) => {
      qc.setQueryData(weddingKeys.wedding(wedding.id), w);
      void qc.invalidateQueries({ queryKey: weddingKeys.budget(wedding.id) });
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const c = budget.catering;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("budget.catering")}</CardTitle>
        <CardDescription>{t("budget.platePriceHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field id="plate" label={t("budget.platePrice")}>
            <Input id="plate" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </form>
        {c.platePriceCents == null ? (
          <p className="text-sm text-muted-foreground">{t("budget.setPlatePrice")}</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t("budget.confirmed")}</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(c.confirmedCents, lang) || "0 zł"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t("budget.maximum")}</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(c.maxCents, lang) || "0 zł"}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

interface ExpenseForm {
  title: string;
  categoryId: string;
  vendorId: string;
  amount: string;
  notes: string;
  payments: { id?: string; amount: string; dueDate: string; paidAt: string; note: string }[];
}

function ExpenseDialog({
  expense,
  categoryId,
  categories,
  onClose,
  onSaved,
}: {
  expense: BudgetExpense | null;
  categoryId: string;
  categories: BudgetCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const hasVendors = PLANS[wedding.plan].features.vendors;
  const { data: vendors = [] } = useQuery({
    queryKey: weddingKeys.vendors(wedding.id),
    queryFn: () => api<Vendor[]>(`/weddings/${wedding.id}/vendors`),
    enabled: hasVendors,
  });
  const form = useForm<ExpenseForm>({
    defaultValues: {
      title: expense?.title ?? "",
      categoryId,
      vendorId: expense?.vendor?.id ?? "",
      amount: zl(expense?.amountCents),
      notes: expense?.notes ?? "",
      payments: (expense?.payments ?? []).map((p) => ({
        id: p.id,
        amount: zl(p.amountCents),
        dueDate: p.dueDate ?? "",
        paidAt: p.paidAt ?? "",
        note: p.note ?? "",
      })),
    },
  });
  const payments = useFieldArray({ control: form.control, name: "payments" });

  const save = useMutation({
    mutationFn: (v: ExpenseForm) =>
      expense
        ? api(`/weddings/${wedding.id}/budget/expenses/${expense.id}`, { method: "PUT", json: v })
        : api(`/weddings/${wedding.id}/budget/expenses`, { method: "POST", json: v }),
    onSuccess: () => {
      onSaved();
      toast.success(t("common.saved"));
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/budget/expenses/${expense!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{expense ? t("budget.editExpense") : t("budget.addExpense")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="x-title" label={t("budget.expenseTitle")}>
              <Input id="x-title" {...form.register("title", { required: true })} aria-invalid={!!form.formState.errors.title} />
            </Field>
            <Field id="x-amount" label={t("budget.amount")}>
              <Input id="x-amount" inputMode="decimal" {...form.register("amount", { required: true })} aria-invalid={!!form.formState.errors.amount} />
            </Field>
            <Field id="x-cat" label={t("budget.category")}>
              <NativeSelect id="x-cat" {...form.register("categoryId")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {hasVendors && (
              <Field id="x-vendor" label={t("budget.vendor")}>
                <NativeSelect id="x-vendor" {...form.register("vendorId")}>
                  <option value="">—</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t("budget.payments")}</legend>
            {payments.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
                <Input inputMode="decimal" placeholder={t("budget.paymentAmount")} aria-label={t("budget.paymentAmount")} {...form.register(`payments.${i}.amount`, { required: true })} />
                <label className="space-y-0.5 text-xs text-muted-foreground">
                  {t("budget.dueDate")}
                  <Input type="date" className="h-9" {...form.register(`payments.${i}.dueDate`)} />
                </label>
                <label className="space-y-0.5 text-xs text-muted-foreground">
                  {t("budget.paidAt")}
                  <Input type="date" className="h-9" {...form.register(`payments.${i}.paidAt`)} />
                </label>
                <Input placeholder={t("budget.paymentNote")} aria-label={t("budget.paymentNote")} {...form.register(`payments.${i}.note`)} />
                <Button type="button" variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => payments.remove(i)}>
                  <X />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => payments.append({ amount: "", dueDate: "", paidAt: "", note: "" })}>
              <Plus />
              {t("budget.addPayment")}
            </Button>
          </fieldset>

          <Field id="x-notes" label={t("budget.notes")}>
            <Textarea id="x-notes" rows={2} {...form.register("notes")} />
          </Field>

          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex items-center justify-between gap-2">
            {expense ? (
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
