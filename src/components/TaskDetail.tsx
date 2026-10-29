import { useAuth } from "@clerk/react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CheckSquare, Menu, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router";
import { Button } from "../UI/Button";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { dueDateKey, formatCalendarDay } from "../lib/dueDates";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import { PageFrame } from "../pages/PageState";
import { useToast } from "../toast/useToast";
import type { Bucket, Folder, Subtask, Task } from "../types/entities";
import { CompletionToggle } from "./CompletionToggle";
import { TaskDueDate } from "./TaskDueDate";
import { TaskImportance } from "./TaskImportance";
import { TaskMarker } from "./TaskMarker";

type DraftSubtask = { key: string; id?: string; title: string; isDone: boolean };
type Draft = {
  name: string;
  description: string;
  dueDate: string;
  importance: Task["importance"];
  isDone: boolean;
  subtasks: DraftSubtask[];
};

function makeDraft(task: Task, subtasks: Subtask[]): Draft {
  return {
    name: task.title,
    description: task.description ?? "",
    dueDate: dueDateKey(task.dueDate) ?? "",
    importance: task.importance,
    isDone: task.isDone,
    subtasks: [...subtasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt.localeCompare(b.createdAt)).map((item) => ({
      key: item.id,
      id: item.id,
      title: item.title,
      isDone: item.isDone,
    })),
  };
}

function SortableSubtask({ id, title, disabled, children }: { id: string; title: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }} className="relative flex min-h-12 items-center gap-3 border-b border-[#efebe8] py-2.5 text-[15px] dark:border-[#312e2b]">
    <button {...attributes} {...listeners} ref={setActivatorNodeRef} aria-label={`Reorder subtask ${title || "new subtask"}`} className="grid h-8 w-7 shrink-0 touch-none cursor-grab place-items-center text-[#aaa29b] active:cursor-grabbing disabled:opacity-50" disabled={disabled} type="button"><Menu aria-hidden="true" size={16} /></button>
    {children}
  </li>;
}

// The invisible mirror gives the editor the same wrapping and height as the text.
function InlineText({
  label,
  value,
  placeholder,
  disabled,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <span className="relative grid min-w-0 whitespace-pre-wrap break-words">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {value || placeholder || " "}
        {"\u200b"}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded bg-[#fff6f1] dark:bg-[#332724]"
      />
      <textarea
        aria-label={label}
        autoFocus={autoFocus}
        className="absolute inset-0 h-full w-full resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 font-inherit text-inherit outline-none disabled:opacity-60"
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        value={value}
      />
    </span>
  );
}

function DraftToggle({
  done,
  label,
  disabled,
  onClick,
}: {
  done: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={done}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full outline-none hover:bg-[#f3f1ef] disabled:opacity-50 dark:hover:bg-[#302d29]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <TaskMarker done={done} />
    </button>
  );
}

// This small form saves directly when viewing an existing task. During task
// creation or editing, subtasks remain part of the task's unsaved draft instead.
function InlineSubtaskCreator({ taskId }: { taskId: string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusAfterSave = useRef(false);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const create = useMutation({
    mutationFn: ({ title }: { title: string; addAnother: boolean }) => request<Subtask>(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ name: title }),
    }),
    onSuccess: (created, { addAnother }) => {
      // The task page and bucket previews share this cache.
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) =>
        [...current.filter((item) => item.id !== created.id), created],
      );
      setName("");
      setAdding(addAnother);
      focusAfterSave.current = addAnother;
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
    },
    onError: (error) => {
      focusAfterSave.current = true;
      toast.error(error instanceof Error ? error.message : "Unable to add subtask.");
    },
    onSettled: () => { saving.current = false; },
  });

  // The input is disabled during the request. Focus it again once it is
  // enabled, so Enter lets the user continue typing the next subtask.
  useEffect(() => {
    if (!create.isPending && adding && focusAfterSave.current) {
      focusAfterSave.current = false;
      inputRef.current?.focus();
    }
  }, [adding, create.isPending]);

  function finish(addAnother: boolean) {
    if (saving.current) return;
    const title = name.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    // A blur and an Enter press can arrive together; create only one subtask.
    saving.current = true;
    create.mutate({ title, addAnother });
  }

  return (
    <>
      {adding && (
        <div className="flex min-h-12 items-center gap-3 border-b border-[#efebe8] py-2.5 text-[15px] dark:border-[#312e2b]">
          <span className="grid h-8 w-8 shrink-0 place-items-center"><TaskMarker /></span>
          <input
            aria-label="New subtask name"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-[#a6a19b] disabled:opacity-60"
            disabled={create.isPending}
            onBlur={() => finish(false)}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") { event.preventDefault(); finish(true); }
              if (event.key === "Escape") { event.preventDefault(); event.currentTarget.blur(); }
            }}
            placeholder="Subtask name"
            ref={inputRef}
            value={name}
          />
        </div>
      )}
      <button
        className="flex min-h-11 items-center gap-3 px-2 text-sm text-[#8a837c] transition-colors hover:text-[#c84b37] disabled:opacity-50 dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
        disabled={adding}
        onClick={() => { setName(""); setAdding(true); }}
        type="button"
      >
        <Plus aria-hidden="true" className="text-[#c84b37] dark:text-[#ff9d87]" size={18} />
        Add subtask
      </button>
    </>
  );
}

function DeleteSubtaskButton({ subtask }: { subtask: Subtask }) {
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const mutationKey = [...subtasksKey, subtask.id, "update"];
  const isSaving = useIsMutating({ mutationKey }) > 0;
  const remove = useMutation({
    mutationKey,
    mutationFn: () => request<void>(`/api/subtasks/${subtask.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) =>
        current.filter((item) => item.id !== subtask.id),
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to delete subtask."),
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: subtasksKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: subtasksKey });
      }
    },
  });

  return (
    <button
      aria-label={`Delete subtask ${subtask.title}`}
      className="shrink-0 rounded p-1 text-[#8a837c] hover:text-[#b74131] disabled:opacity-50 dark:text-[#aaa29b] dark:hover:text-[#ff9680]"
      disabled={isSaving || remove.isPending}
      onClick={() => remove.mutate()}
      type="button"
    >
      <X aria-hidden="true" size={16} />
    </button>
  );
}

function closePickerOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary")?.focus();
}

function closePickerOnBlur(event: FocusEvent<HTMLDetailsElement>) {
  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
}

type CreationOptions = { buckets: Bucket[]; folders: Folder[]; returnTo: string; bucketFromPage?: boolean };

export function TaskDetail({ task, subtasks, creation }: { task: Task; subtasks: Subtask[]; creation?: CreationOptions }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialDraft = () => makeDraft(task, subtasks);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [saved, setSaved] = useState<Draft>(initialDraft);
  const [editing, setEditing] = useState(() => Boolean(creation) || location.state?.startEditing === true);
  const [bucketId, setBucketId] = useState(task.bucketId);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const createdTaskRef = useRef<Task | null>(null);
  const allowNavigation = useRef(false);
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const subtaskSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reorderSubtasks = useMutation({
    mutationKey: [...subtasksKey, task.id, "order"],
    mutationFn: (ids: string[]) => request<Subtask[]>(`/api/tasks/${task.id}/subtasks/order`, { method: "PUT", body: JSON.stringify({ ids }) }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: subtasksKey });
      const previous = queryClient.getQueryData<Subtask[]>(subtasksKey)?.filter((item) => ids.includes(item.id));
      queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((item) => {
        const position = ids.indexOf(item.id);
        return position < 0 ? item : { ...item, position };
      }));
      return { previous };
    },
    onSuccess: (savedItems) => {
      const savedById = new Map(savedItems.map((item) => [item.id, item]));
      queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((item) => savedById.get(item.id) ?? item));
    },
    onError: (caught, _ids, context) => {
      if (context?.previous) {
        const previous = new Map(context.previous.map((item) => [item.id, item.position]));
        queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((item) =>
          previous.has(item.id) ? { ...item, position: previous.get(item.id)! } : item,
        ));
      }
      toast.error(caught instanceof Error ? caught.message : "Unable to reorder subtasks.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subtasksKey }),
  });
  const dirty = editing && (JSON.stringify(draft) !== JSON.stringify(saved) || (Boolean(creation) && bucketId !== task.bucketId));
  const shouldBlock = useCallback(() => !allowNavigation.current && (dirty || saving), [dirty, saving]);
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (!saving && window.confirm("Discard your unsaved task changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker, saving]);

  useEffect(() => {
    if (!dirty && !saving) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function startEditing() {
    const next = makeDraft(task, subtasks);
    setDraft(next);
    setSaved(next);
    setError(null);
    setEditing(true);
  }
  function cancelEditing() {
    setError(null);
    if (creation) {
      allowNavigation.current = true;
      void navigate(createdTaskId ? `/tasks/${createdTaskId}` : creation.returnTo, { replace: true, viewTransition: true });
      return;
    }
    setEditing(false);
  }
  function changeSubtask(key: string, changes: Partial<DraftSubtask>) {
    setDraft((current) => ({
      ...current,
      subtasks: current.subtasks.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    }));
  }
  function addSubtask() {
    setDraft((value) => ({
      ...value,
      subtasks: [...value.subtasks, { key: crypto.randomUUID(), title: "", isDone: false }],
    }));
  }

  async function save() {
    if (savingRef.current) return;
    if (!draft.name.trim()) {
      setError("Enter a task name.");
      return;
    }
    if (creation && !createdTaskRef.current && !creation.buckets.some((bucket) => bucket.id === bucketId)) {
      setError("Choose a bucket for this task.");
      return;
    }
    if (draft.subtasks.some((item) => !item.title.trim())) {
      setError("Give every subtask a name or remove the empty row.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    let current = { ...draft, subtasks: draft.subtasks.map((item) => ({ ...item })) };
    let baseline = { ...saved, subtasks: saved.subtasks.map((item) => ({ ...item })) };
    const progress = () => {
      setDraft({ ...current, subtasks: [...current.subtasks] });
      setSaved({ ...baseline, subtasks: [...baseline.subtasks] });
    };
    try {
      if (creation && !createdTaskRef.current) {
        const created = await request<Task>(`/api/buckets/${bucketId}/tasks`, {
          method: "POST",
          body: JSON.stringify({ name: current.name.trim(), description: current.description.trim() || null, dueDate: current.dueDate || null, importance: current.importance }),
        });
        createdTaskRef.current = created;
        setCreatedTaskId(created.id);
        queryClient.setQueryData<Task[]>(tasksKey, (items = []) => [created, ...items.filter((item) => item.id !== created.id)]);
        baseline = { ...baseline, name: created.title, description: created.description ?? "", dueDate: dueDateKey(created.dueDate) ?? "", importance: created.importance, isDone: created.isDone };
        current = { ...current, name: created.title, description: created.description ?? "", dueDate: dueDateKey(created.dueDate) ?? "", importance: created.importance };
        progress();
      }
      const taskId = createdTaskRef.current?.id ?? task.id;
      const updated = await request<Task>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: current.name.trim(),
          description: current.description.trim() || null,
          dueDate: current.dueDate || null,
          importance: current.importance,
          isDone: current.isDone,
        }),
      });
      queryClient.setQueryData<Task[]>(tasksKey, (items = []) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      current = {
        ...current,
        name: updated.title,
        description: updated.description ?? "",
        dueDate: dueDateKey(updated.dueDate) ?? "",
        importance: updated.importance,
        isDone: updated.isDone,
      };
      baseline = {
        ...baseline,
        name: current.name,
        description: current.description,
        dueDate: current.dueDate,
        importance: current.importance,
        isDone: current.isDone,
      };
      progress();
      for (const item of [...baseline.subtasks]) {
        if (item.id && !current.subtasks.some((next) => next.id === item.id)) {
          await request<void>(`/api/subtasks/${item.id}`, { method: "DELETE" });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) =>
            items.filter((next) => next.id !== item.id),
          );
          baseline.subtasks = baseline.subtasks.filter((next) => next.id !== item.id);
          progress();
        }
      }
      for (const item of [...current.subtasks]) {
        let id = item.id;
        let previous = baseline.subtasks.find((next) => next.id === id && id);
        if (!id) {
          const created = await request<Subtask>(`/api/tasks/${taskId}/subtasks`, {
            method: "POST",
            body: JSON.stringify({ name: item.title.trim() }),
          });
          id = created.id;
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => [...items, created]);
          current.subtasks = current.subtasks.map((next) =>
            next.key === item.key ? { ...next, id: created.id, title: created.title } : next,
          );
          previous = {
            key: item.key,
            id: created.id,
            title: created.title,
            isDone: created.isDone,
          };
          baseline.subtasks = [...baseline.subtasks, previous];
          progress();
        }
        if (previous && item.title.trim() !== previous.title) {
          const updatedSubtask = await request<Subtask>(`/api/subtasks/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name: item.title.trim() }),
          });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) =>
            items.map((next) => (next.id === id ? updatedSubtask : next)),
          );
          current.subtasks = current.subtasks.map((next) =>
            next.id === id ? { ...next, title: updatedSubtask.title } : next,
          );
          baseline.subtasks = baseline.subtasks.map((next) =>
            next.id === id ? { ...next, title: updatedSubtask.title } : next,
          );
          progress();
        }
        if (previous && item.isDone !== previous.isDone) {
          const updatedSubtask = await request<Subtask>(`/api/subtasks/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ isDone: item.isDone }),
          });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) =>
            items.map((next) => (next.id === id ? updatedSubtask : next)),
          );
          baseline.subtasks = baseline.subtasks.map((next) =>
            next.id === id ? { ...next, isDone: updatedSubtask.isDone } : next,
          );
          progress();
        }
      }
      // Drafts use temporary keys until creation succeeds. Once all IDs are
      // known, save the exact visible order as one atomic backend operation.
      const orderedIds = current.subtasks.map((item) => item.id).filter((id): id is string => Boolean(id));
      if (orderedIds.length === current.subtasks.length && JSON.stringify(orderedIds) !== JSON.stringify(baseline.subtasks.map((item) => item.id))) {
        const ordered = await request<Subtask[]>(`/api/tasks/${taskId}/subtasks/order`, { method: "PUT", body: JSON.stringify({ ids: orderedIds }) });
        const byId = new Map(ordered.map((item) => [item.id, item]));
        queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((item) => byId.get(item.id) ?? item));
        baseline.subtasks = [...current.subtasks];
        progress();
      }
      setEditing(false);
      toast.success(creation ? "Task created successfully." : "Task changes saved.");
      if (creation) {
        allowNavigation.current = true;
        void navigate(`/tasks/${taskId}`, { replace: true, viewTransition: true });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save task changes.";
      setError(creation && createdTaskRef.current ? `Task created, but some changes could not be saved. ${message}` : message);
    } finally {
      savingRef.current = false;
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: tasksKey });
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
    }
  }

  const shown = editing ? draft : makeDraft(task, subtasks);
  function onSubtaskDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || saving || reorderSubtasks.isPending) return;
    const from = shown.subtasks.findIndex((item) => item.key === active.id);
    const to = shown.subtasks.findIndex((item) => item.key === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(shown.subtasks, from, to);
    if (editing) setDraft((current) => ({ ...current, subtasks: next }));
    else reorderSubtasks.mutate(next.map((item) => item.id!));
  }
  return (
    <PageFrame
      action={
        <div className="flex w-[152px] justify-end gap-2">
          {editing ? (
            <>
              <Button disabled={saving} onClick={cancelEditing} variant="ghost">
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : creation ? "Create" : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={startEditing} variant="secondary">
              Edit task
            </Button>
          )}
        </div>
      }
      backTo={creation ? (createdTaskId ? `/tasks/${createdTaskId}` : creation.returnTo) : `/buckets/${task.bucketId}`}
      backLabel={creation ? "Back" : "Back to bucket"}
      eyebrow="Task"
      titleLeading={
        <div className="-ml-2">
          {editing ? (
            <DraftToggle
              done={draft.isDone}
              label={draft.isDone ? "Mark task incomplete" : "Mark task complete"}
              disabled={saving}
              onClick={() => setDraft((value) => ({ ...value, isDone: !value.isDone }))}
            />
          ) : (
            <CompletionToggle kind="task" record={task} />
          )}
        </div>
      }
      title={
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`min-w-0 ${shown.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}
          >
            {editing ? (
              <InlineText
                label="Task name"
                value={draft.name}
                placeholder={creation ? "Task name" : undefined}
                disabled={saving}
                onChange={(name) => setDraft((value) => ({ ...value, name }))}
              />
            ) : (
              task.title
            )}
          </span>
          {editing ? (
            <details
              className="relative shrink-0 text-sm font-normal"
              onBlur={closePickerOnBlur}
              onKeyDown={closePickerOnEscape}
            >
              <summary
                aria-label="Change importance"
                className="flex h-2.5 w-2.5 cursor-pointer list-none items-center justify-center rounded-full focus:outline-none"
              >
                <TaskImportance importance={draft.importance} />
              </summary>
              <div className="absolute left-0 top-full z-10 mt-2 flex gap-2 rounded-lg border border-[#dedad4] bg-white p-2 shadow-lg dark:border-[#494642] dark:bg-[#292724]">
                {(["GREEN", "AMBER", "RED"] as const).map((importance) => (
                  <button
                    aria-label={`Set importance to ${importanceLabels[importance]}`}
                    aria-pressed={draft.importance === importance}
                    className="grid h-8 w-8 place-items-center rounded-full"
                    disabled={saving}
                    key={importance}
                    onClick={() => setDraft((value) => ({ ...value, importance }))}
                    type="button"
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${importanceColorClasses[importance]}`}
                    />
                  </button>
                ))}
              </div>
            </details>
          ) : (
            <TaskImportance importance={task.importance} />
          )}
        </span>
      }
    >
      {editing ? (
        <div className="relative mt-3 flex items-center gap-2 text-sm text-[#716a64] dark:text-[#b9b1aa]">
          <CalendarDays aria-hidden="true" size={16} />
          <details onBlur={closePickerOnBlur} onKeyDown={closePickerOnEscape}>
            <summary className="cursor-pointer list-none rounded-sm focus:outline-none">
              {draft.dueDate ? `Due ${formatCalendarDay(draft.dueDate)}` : "No due date set"}
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 rounded-lg border border-[#dedad4] bg-white p-2 shadow-lg dark:border-[#494642] dark:bg-[#292724]">
              <input
                aria-label="Due date"
                disabled={saving}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, dueDate: event.target.value }))
                }
                type="date"
                value={draft.dueDate}
              />
            </div>
          </details>
        </div>
      ) : (
        <TaskDueDate task={task} />
      )}
      {creation && !creation.bucketFromPage && (
        <label className="mt-4 flex items-center gap-2 text-sm text-[#716a64] dark:text-[#b9b1aa]">
          <span>Bucket</span>
          <select aria-label="Bucket" className="min-w-0 max-w-full rounded border border-[#dedad4] bg-white px-2 py-1 text-[#292827] outline-none disabled:opacity-60 dark:border-[#494642] dark:bg-[#292724] dark:text-[#f3efea]" disabled={saving || Boolean(createdTaskId)} value={bucketId} onChange={(event) => setBucketId(event.target.value)}>
            <option value="">Choose a bucket</option>
            {creation.folders.map((folder) => {
              const buckets = creation.buckets.filter((bucket) => bucket.folderId === folder.id);
              return buckets.length ? <optgroup key={folder.id} label={folder.name}>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}</optgroup> : null;
            })}
          </select>
        </label>
      )}
      <section className="mt-10 border-y border-[#e9e5e2] py-5 dark:border-[#393531]">
        <h2 className="text-sm font-semibold">Description</h2>
        <div className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]">
          {editing ? (
            <InlineText
              label="Description"
              value={draft.description}
              placeholder="No description yet."
              disabled={saving}
              onChange={(description) => setDraft((value) => ({ ...value, description }))}
            />
          ) : (
            (task.description ?? "No description yet.")
          )}
        </div>
      </section>
      <section className="mt-11">
        <div className="flex h-9 items-center gap-2 border-b border-[#e9e5e2] text-[15px] font-semibold dark:border-[#393531]">
          <CheckSquare aria-hidden="true" size={17} /> Subtasks{" "}
          <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">
            {shown.subtasks.length}
          </span>
        </div>
        {shown.subtasks.length === 0 ? (
          <p className="py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">No subtasks yet.</p>
        ) : (
          <DndContext sensors={subtaskSensors} collisionDetection={closestCenter} onDragEnd={onSubtaskDragEnd}><SortableContext items={shown.subtasks.map((item) => item.key)} strategy={verticalListSortingStrategy}><ul>
            {shown.subtasks.map((item, index) => (
              <SortableSubtask key={item.key} id={item.key} title={item.title} disabled={saving || reorderSubtasks.isPending}>
                {editing ? (
                  <DraftToggle
                    done={item.isDone}
                    label={`Mark subtask ${index + 1} ${item.isDone ? "incomplete" : "complete"}`}
                    disabled={saving}
                    onClick={() => changeSubtask(item.key, { isDone: !item.isDone })}
                  />
                ) : (
                  <CompletionToggle
                    kind="subtask"
                    record={subtasks.find((subtask) => subtask.id === item.id)!}
                  />
                )}
                <span
                  className={`min-w-0 flex-1 ${item.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}
                >
                  {editing ? (
                    <InlineText
                      label={`Subtask ${index + 1}`}
                      value={item.title}
                      placeholder="Subtask name"
                      disabled={saving}
                      autoFocus={!item.id}
                      onChange={(title) => changeSubtask(item.key, { title })}
                      onBlur={() => {
                        // A blank new row is only a draft, so discard it when
                        // the user leaves it. Existing subtasks are never deleted.
                        if (!item.id && !item.title.trim()) {
                          setDraft((value) => ({
                            ...value,
                            subtasks: value.subtasks.filter((next) => next.key !== item.key),
                          }));
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          // Leaving the field also runs the empty-draft cleanup.
                          event.currentTarget.blur();
                        }
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          if (item.title.trim()) addSubtask();
                        }
                      }}
                    />
                  ) : (
                    item.title
                  )}
                </span>
                {editing ? (
                  <button
                    aria-label={`Remove subtask ${index + 1}`}
                    className="absolute right-0 rounded bg-[#fffdfc] p-1 text-[#8a837c] hover:text-[#b74131] dark:bg-[#1e1c1a]"
                    disabled={saving}
                    onClick={() =>
                      setDraft((value) => ({
                        ...value,
                        subtasks: value.subtasks.filter((next) => next.key !== item.key),
                      }))
                    }
                    type="button"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <DeleteSubtaskButton subtask={subtasks.find((subtask) => subtask.id === item.id)!} />
                )}
              </SortableSubtask>
            ))}
          </ul></SortableContext></DndContext>
        )}
        {editing ? <button
          className="flex min-h-11 items-center gap-3 px-2 text-sm text-[#8a837c] transition-colors hover:text-[#c84b37] disabled:opacity-50 dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
          disabled={saving}
          onClick={addSubtask}
          type="button"
        >
          <Plus aria-hidden="true" className="text-[#c84b37] dark:text-[#ff9d87]" size={18} />
          Add subtask
        </button> : <InlineSubtaskCreator taskId={task.id} />}
      </section>
      {error && (
        <p className="mt-4 text-sm text-[#a13d2d] dark:text-[#ffad9b]" role="alert">
          {error}
        </p>
      )}
    </PageFrame>
  );
}
