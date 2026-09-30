import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TASK_CATEGORIES, TASK_STATUSES, type TaskInput } from "@wedding/shared";
import { CalendarClock, Link2, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { daysUntil, formatDate } from "@/lib/format";
import type { Assignee, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan, useWedding, useWeddingData, weddingKeys } from "./context";

type Group = "overdue" | "thisMonth" | "later" | "noDate" | "done";

function groupOf(task: Task): Group {
  if (task.status === "DONE") return "done";
  if (!task.dueDate) return "noDate";
  const days = daysUntil(task.dueDate);
  if (days < 0) return "overdue";
  return days <= 30 ? "thisMonth" : "later";
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  const { id } = useWedding();
  return () => {
    void qc.invalidateQueries({ queryKey: weddingKeys.tasks(id) });
    void qc.invalidateQueries({ queryKey: weddingKeys.stats(id) });
    void qc.invalidateQueries({ queryKey: ["wedding", id, "calendar"] });
  };
}

export function TasksPage() {
  const { t } = useTranslation();
  const wedding = useWedding();
  const canEdit = useCan("CO_PLANNER");
  const invalidate = useInvalidateTasks();
  const { data: tasks } = useWeddingData<Task[]>("tasks", "/tasks");
  const { data: assignees = [] } = useWeddingData<Assignee[]>("assignees", "/assignees");
  const [category, setCategory] = useState("");
  const [assignee, setAssignee] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const qc = useQueryClient();
  const generate = useMutation({
    mutationFn: () => api<{ created: number }>(`/weddings/${wedding.id}/tasks/generate`, { method: "POST" }),
    onSuccess: ({ created }) => {
      invalidate();
      // Generowanie tworzy też domyślne osoby (para), jeśli lista była pusta.
      void qc.invalidateQueries({ queryKey: weddingKeys.assignees(wedding.id) });
      toast.success(created ? t("tasks.generated", { count: created }) : t("tasks.generatedNone"));
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  const groups = useMemo(() => {
    const filtered = (tasks ?? []).filter(
      (task) =>
        (!category || task.category === category) &&
        (!assignee || (assignee === "none" ? !task.assignee : task.assignee?.id === assignee)),
    );
    const map: Record<Group, Task[]> = { overdue: [], thisMonth: [], later: [], noDate: [], done: [] };
    for (const task of filtered) map[groupOf(task)].push(task);
    map.done.sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
    return map;
  }, [tasks, category, assignee]);

  const total = tasks?.length ?? 0;
  const done = tasks?.filter((x) => x.status === "DONE").length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <h2 className="font-serif text-2xl font-semibold">{t("tasks.title")}</h2>
            <div className="flex items-center gap-3">
              <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm text-muted-foreground">{t("tasks.progress", { done, total })}</span>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <ListPlus />
                {t("tasks.generate")}
              </Button>
              <Button onClick={() => setEditing("new")}>
                <Plus />
                {t("tasks.add")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("tasks.category")}>
            <option value="">{t("tasks.category")}: {t("common.all")}</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`tasks.categories.${c}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect className="w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label={t("tasks.assignee")}>
            <option value="">{t("tasks.assignee")}: {t("tasks.mine")}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="none">{t("tasks.nobody")}</option>
          </NativeSelect>
          <CheckboxField className="ml-1" label={t("tasks.showDone")} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        </div>

        {!tasks ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">{t("tasks.empty")}</CardContent>
          </Card>
        ) : (
          (["overdue", "thisMonth", "later", "noDate", ...(showDone ? (["done"] as const) : [])] as Group[]).map((g) =>
            groups[g].length ? (
              <section key={g} className="space-y-2">
                <h3 className={cn("text-sm font-semibold uppercase tracking-wide text-muted-foreground", g === "overdue" && "text-destructive")}>
                  {t(`tasks.groups.${g}`)} <span className="font-normal">({groups[g].length})</span>
                </h3>
                <ul className="divide-y rounded-lg border bg-card">
                  {groups[g].map((task) => (
                    <TaskRow key={task.id} task={task} assignees={assignees} canEdit={canEdit} onEdit={() => setEditing(task)} onChange={invalidate} />
                  ))}
                </ul>
              </section>
            ) : null,
          )
        )}
      </div>

      <AssigneesCard assignees={assignees} canEdit={canEdit} />

      {editing && <TaskDialog task={editing === "new" ? null : editing} assignees={assignees} onClose={() => setEditing(null)} onSaved={invalidate} />}
    </div>
  );
}

function TaskRow({
  task,
  assignees,
  canEdit,
  onEdit,
  onChange,
}: {
  task: Task;
  assignees: Assignee[];
  canEdit: boolean;
  onEdit: () => void;
  onChange: () => void;
}) {
  const { t, i18n } = useTranslation();
  const wedding = useWedding();
  const patch = useMutation({
    mutationFn: (body: { status?: string; assigneeId?: string | null }) => api(`/weddings/${wedding.id}/tasks/${task.id}`, { method: "PATCH", json: body }),
    onSuccess: onChange,
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const done = task.status === "DONE";
  const days = task.dueDate ? daysUntil(task.dueDate) : null;

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-default"
        checked={done}
        disabled={!canEdit || patch.isPending}
        onChange={(e) => patch.mutate({ status: e.target.checked ? "DONE" : "TODO" })}
        aria-label={task.title}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={!canEdit}
          className={cn("text-left font-medium hover:underline disabled:no-underline", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", !done && days !== null && days < 0 && "font-medium text-destructive")}>
              {task.dueMode === "RELATIVE" ? <Link2 className="size-3" aria-label={t("tasks.relativeHint")} /> : <CalendarClock className="size-3" />}
              {formatDate(task.dueDate, i18n.resolvedLanguage, "medium")}
              {!done && days !== null && days < 0 && ` · ${t("tasks.daysLate", { count: -days })}`}
            </span>
          )}
          <Badge variant="muted">{t(`tasks.categories.${task.category}`)}</Badge>
          {task.status === "IN_PROGRESS" && <Badge variant="warning">{t("tasks.statuses.IN_PROGRESS")}</Badge>}
        </div>
      </div>
      <NativeSelect
        className="h-8 w-32 shrink-0 text-xs"
        value={task.assignee?.id ?? ""}
        disabled={!canEdit}
        onChange={(e) => patch.mutate({ assigneeId: e.target.value || null })}
        aria-label={t("tasks.assignee")}
      >
        <option value="">{t("tasks.nobody")}</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </NativeSelect>
      {canEdit && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("common.edit")} onClick={onEdit}>
          <Pencil className="!size-3.5" />
        </Button>
      )}
    </li>
  );
}

function TaskDialog({ task, assignees, onClose, onSaved }: { task: Task | null; assignees: Assignee[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const form = useForm<Required<Pick<TaskInput, "title" | "category" | "status">> & { description: string; dueDate: string; assigneeId: string }>({
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      category: task?.category ?? "PLANNING",
      dueDate: task?.dueDate ?? "",
      status: task?.status ?? "TODO",
      assigneeId: task?.assignee?.id ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (v: TaskInput) =>
      task
        ? api(`/weddings/${wedding.id}/tasks/${task.id}`, { method: "PUT", json: v })
        : api(`/weddings/${wedding.id}/tasks`, { method: "POST", json: v }),
    onSuccess: () => {
      onSaved();
      toast.success(t("common.saved"));
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/tasks/${task!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? t("tasks.edit") : t("tasks.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field id="t-title" label={t("tasks.name")}>
            <Input id="t-title" {...form.register("title", { required: true })} aria-invalid={!!form.formState.errors.title} />
          </Field>
          <Field id="t-desc" label={t("tasks.description")}>
            <Textarea id="t-desc" rows={3} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="t-cat" label={t("tasks.category")}>
              <NativeSelect id="t-cat" {...form.register("category")}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`tasks.categories.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="t-due" label={t("tasks.dueDate")}>
              <Input id="t-due" type="date" {...form.register("dueDate")} />
            </Field>
            <Field id="t-status" label={t("tasks.status")}>
              <NativeSelect id="t-status" {...form.register("status")}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`tasks.statuses.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="t-who" label={t("tasks.assignee")}>
              <NativeSelect id="t-who" {...form.register("assigneeId")}>
                <option value="">{t("tasks.nobody")}</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {task?.dueDate && (
            <p className="text-xs text-muted-foreground">{task.dueMode === "RELATIVE" ? t("tasks.relativeHint") : t("tasks.fixedHint")}</p>
          )}
          {save.isError && <p className="text-sm text-destructive">{errorMessage(t, save.error)}</p>}
          <div className="flex items-center justify-between gap-2">
            {task ? (
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

function AssigneesCard({ assignees, canEdit }: { assignees: Assignee[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const wedding = useWedding();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: weddingKeys.assignees(wedding.id) });
    void qc.invalidateQueries({ queryKey: weddingKeys.tasks(wedding.id) });
  };
  const add = useMutation({
    mutationFn: () => api(`/weddings/${wedding.id}/assignees`, { method: "POST", json: { name } }),
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/weddings/${wedding.id}/assignees/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(t, e)),
  });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">{t("tasks.people")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {assignees.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{a.name}</span>
            {canEdit && (
              <Button variant="ghost" size="icon" className="size-7" aria-label={t("common.delete")} onClick={() => remove.mutate(a.id)}>
                <X className="!size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {canEdit && (
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) add.mutate();
            }}
          >
            <Input className="h-9" placeholder={t("tasks.personName")} aria-label={t("tasks.addPerson")} value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="icon" variant="outline" aria-label={t("tasks.addPerson")} disabled={add.isPending}>
              <Plus />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
