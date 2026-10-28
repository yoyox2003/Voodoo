import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckSquare, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useBlocker, useLocation } from "react-router";
import { Button } from "../UI/Button";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { dueDateKey, formatCalendarDay } from "../lib/dueDates";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import { PageFrame } from "../pages/PageState";
import { useToast } from "../toast/useToast";
import type { Subtask, Task } from "../types/entities";
import { CompletionToggle } from "./CompletionToggle";
import { TaskDueDate } from "./TaskDueDate";
import { TaskImportance } from "./TaskImportance";
import { TaskMarker } from "./TaskMarker";

type DraftSubtask = { key: string; id?: string; title: string; isDone: boolean };
type Draft = { name: string; description: string; dueDate: string; importance: Task["importance"]; isDone: boolean; subtasks: DraftSubtask[] };

function makeDraft(task: Task, subtasks: Subtask[]): Draft {
  return { name: task.title, description: task.description ?? "", dueDate: dueDateKey(task.dueDate) ?? "", importance: task.importance, isDone: task.isDone,
    subtasks: subtasks.map((item) => ({ key: item.id, id: item.id, title: item.title, isDone: item.isDone })) };
}

// The invisible mirror gives the editor the same wrapping and height as the text.
function InlineText({ label, value, placeholder, disabled, onChange, onKeyDown, autoFocus = false }: { label: string; value: string; placeholder?: string; disabled: boolean; onChange: (value: string) => void; onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void; autoFocus?: boolean }) {
  return <span className="relative grid min-w-0 whitespace-pre-wrap break-words">
    <span aria-hidden="true" className="invisible col-start-1 row-start-1">{value || placeholder || " "}{"\u200b"}</span>
    <span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded bg-[#fff6f1] dark:bg-[#332724]" />
    <textarea aria-label={label} autoFocus={autoFocus} className="absolute inset-0 h-full w-full resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 font-inherit text-inherit outline-none focus:ring-2 focus:ring-inset focus:ring-[#d95d47] disabled:opacity-60" disabled={disabled} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} rows={1} value={value} />
  </span>;
}

function DraftToggle({ done, label, disabled, onClick }: { done: boolean; label: string; disabled: boolean; onClick: () => void }) {
  return <button aria-label={label} aria-pressed={done} className="grid h-8 w-8 shrink-0 place-items-center rounded-full outline-none hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] disabled:opacity-50 dark:hover:bg-[#302d29]" disabled={disabled} onClick={onClick} type="button"><TaskMarker done={done} /></button>;
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

export function TaskDetail({ task, subtasks }: { task: Task; subtasks: Subtask[] }) {
  const location = useLocation();
  const initialDraft = () => makeDraft(task, subtasks);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [saved, setSaved] = useState<Draft>(initialDraft);
  const [editing, setEditing] = useState(() => location.state?.startEditing === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);
  const blocker = useBlocker(dirty || saving);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (!saving && window.confirm("Discard your unsaved task changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker, saving]);

  useEffect(() => {
    if (!dirty && !saving) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function startEditing() {
    const next = makeDraft(task, subtasks);
    setDraft(next); setSaved(next); setError(null); setEditing(true);
  }
  function cancelEditing() { setError(null); setEditing(false); }
  function changeSubtask(key: string, changes: Partial<DraftSubtask>) {
    setDraft((current) => ({ ...current, subtasks: current.subtasks.map((item) => item.key === key ? { ...item, ...changes } : item) }));
  }
  function addSubtask() {
    setDraft((value) => ({ ...value, subtasks: [...value.subtasks, { key: crypto.randomUUID(), title: "", isDone: false }] }));
  }

  async function save() {
    if (savingRef.current) return;
    if (!draft.name.trim()) { setError("Enter a task name."); return; }
    if (draft.subtasks.some((item) => !item.title.trim())) { setError("Give every subtask a name or remove the empty row."); return; }
    savingRef.current = true; setSaving(true); setError(null);
    let current = { ...draft, subtasks: draft.subtasks.map((item) => ({ ...item })) };
    let baseline = { ...saved, subtasks: saved.subtasks.map((item) => ({ ...item })) };
    const progress = () => { setDraft({ ...current, subtasks: [...current.subtasks] }); setSaved({ ...baseline, subtasks: [...baseline.subtasks] }); };
    try {
      const updated = await request<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ name: current.name.trim(), description: current.description.trim() || null, dueDate: current.dueDate || null, importance: current.importance, isDone: current.isDone }) });
      queryClient.setQueryData<Task[]>(tasksKey, (items = []) => items.map((item) => item.id === updated.id ? updated : item));
      current = { ...current, name: updated.title, description: updated.description ?? "", dueDate: dueDateKey(updated.dueDate) ?? "", importance: updated.importance, isDone: updated.isDone };
      baseline = { ...baseline, name: current.name, description: current.description, dueDate: current.dueDate, importance: current.importance, isDone: current.isDone };
      progress();
      for (const item of [...baseline.subtasks]) {
        if (item.id && !current.subtasks.some((next) => next.id === item.id)) {
          await request<void>(`/api/subtasks/${item.id}`, { method: "DELETE" });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.filter((next) => next.id !== item.id));
          baseline.subtasks = baseline.subtasks.filter((next) => next.id !== item.id); progress();
        }
      }
      for (const item of [...current.subtasks]) {
        let id = item.id;
        let previous = baseline.subtasks.find((next) => next.id === id && id);
        if (!id) {
          const created = await request<Subtask>(`/api/tasks/${task.id}/subtasks`, { method: "POST", body: JSON.stringify({ name: item.title.trim() }) });
          id = created.id;
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => [created, ...items]);
          current.subtasks = current.subtasks.map((next) => next.key === item.key ? { ...next, id: created.id, title: created.title } : next);
          previous = { key: item.key, id: created.id, title: created.title, isDone: created.isDone };
          baseline.subtasks = [...baseline.subtasks, previous]; progress();
        }
        if (previous && item.title.trim() !== previous.title) {
          const updatedSubtask = await request<Subtask>(`/api/subtasks/${id}`, { method: "PUT", body: JSON.stringify({ name: item.title.trim() }) });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((next) => next.id === id ? updatedSubtask : next));
          current.subtasks = current.subtasks.map((next) => next.id === id ? { ...next, title: updatedSubtask.title } : next);
          baseline.subtasks = baseline.subtasks.map((next) => next.id === id ? { ...next, title: updatedSubtask.title } : next); progress();
        }
        if (previous && item.isDone !== previous.isDone) {
          const updatedSubtask = await request<Subtask>(`/api/subtasks/${id}`, { method: "PATCH", body: JSON.stringify({ isDone: item.isDone }) });
          queryClient.setQueryData<Subtask[]>(subtasksKey, (items = []) => items.map((next) => next.id === id ? updatedSubtask : next));
          baseline.subtasks = baseline.subtasks.map((next) => next.id === id ? { ...next, isDone: updatedSubtask.isDone } : next); progress();
        }
      }
      setEditing(false); toast.success("Task changes saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save task changes.");
    } finally {
      savingRef.current = false; setSaving(false);
      void queryClient.invalidateQueries({ queryKey: tasksKey });
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
    }
  }

  const shown = editing ? draft : makeDraft(task, subtasks);
  return <PageFrame
    action={<div className="flex w-[152px] justify-end gap-2">{editing ? <><Button disabled={saving} onClick={cancelEditing} variant="ghost">Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button></> : <Button onClick={startEditing} variant="secondary">Edit task</Button>}</div>}
    backTo={`/buckets/${task.bucketId}`} backLabel="Back to bucket" eyebrow="Task"
    titleLeading={<div className="-ml-2">{editing ? <DraftToggle done={draft.isDone} label={draft.isDone ? "Mark task incomplete" : "Mark task complete"} disabled={saving} onClick={() => setDraft((value) => ({ ...value, isDone: !value.isDone }))} /> : <CompletionToggle kind="task" record={task} />}</div>}
    title={<span className="flex min-w-0 items-center gap-3"><span className={`min-w-0 ${shown.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}>{editing ? <InlineText label="Task name" value={draft.name} disabled={saving} onChange={(name) => setDraft((value) => ({ ...value, name }))} /> : task.title}</span>{editing ? <details className="relative shrink-0 text-sm font-normal" onBlur={closePickerOnBlur} onKeyDown={closePickerOnEscape}><summary aria-label="Change importance" className="flex h-2.5 w-2.5 cursor-pointer list-none items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-[#d95d47]"><TaskImportance importance={draft.importance} /></summary><div className="absolute left-0 top-full z-10 mt-2 flex gap-2 rounded-lg border border-[#dedad4] bg-white p-2 shadow-lg dark:border-[#494642] dark:bg-[#292724]">{(["GREEN", "AMBER", "RED"] as const).map((importance) => <button aria-label={`Set importance to ${importanceLabels[importance]}`} aria-pressed={draft.importance === importance} className="grid h-8 w-8 place-items-center rounded-full focus:ring-2 focus:ring-[#d95d47]" disabled={saving} key={importance} onClick={() => setDraft((value) => ({ ...value, importance }))} type="button"><span className={`h-3 w-3 rounded-full ${importanceColorClasses[importance]}`} /></button>)}</div></details> : <TaskImportance importance={task.importance} />}</span>}
  >
    {editing ? <div className="relative mt-3 flex items-center gap-2 text-sm text-[#716a64] dark:text-[#b9b1aa]"><CalendarDays aria-hidden="true" size={16} /><details onBlur={closePickerOnBlur} onKeyDown={closePickerOnEscape}><summary className="cursor-pointer list-none rounded-sm focus:outline-none focus:ring-2 focus:ring-[#d95d47]">{draft.dueDate ? `Due ${formatCalendarDay(draft.dueDate)}` : "No due date set"}</summary><div className="absolute left-0 top-full z-10 mt-2 rounded-lg border border-[#dedad4] bg-white p-2 shadow-lg dark:border-[#494642] dark:bg-[#292724]"><input aria-label="Due date" disabled={saving} onChange={(event) => setDraft((value) => ({ ...value, dueDate: event.target.value }))} type="date" value={draft.dueDate} /></div></details></div> : <TaskDueDate task={task} />}
    <section className="mt-10 border-y border-[#e9e5e2] py-5 dark:border-[#393531]"><h2 className="text-sm font-semibold">Description</h2><div className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]">{editing ? <InlineText label="Description" value={draft.description} placeholder="No description yet." disabled={saving} onChange={(description) => setDraft((value) => ({ ...value, description }))} /> : task.description ?? "No description yet."}</div></section>
    <section className="mt-11"><div className="flex h-9 items-center gap-2 border-b border-[#e9e5e2] text-[15px] font-semibold dark:border-[#393531]"><CheckSquare aria-hidden="true" size={17} /> Subtasks <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{shown.subtasks.length}</span>{editing && <button aria-label="Add subtask" className="ml-auto rounded p-1 text-[#c84b37] hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] dark:hover:bg-[#302d29]" disabled={saving} onClick={addSubtask} type="button"><Plus size={18} /></button>}</div>
      {shown.subtasks.length === 0 ? <p className="py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">No subtasks yet.</p> : <ul>{shown.subtasks.map((item, index) => <li className="relative flex min-h-12 items-center gap-3 border-b border-[#efebe8] py-2.5 text-[15px] dark:border-[#312e2b]" key={item.key}>{editing ? <DraftToggle done={item.isDone} label={`Mark subtask ${index + 1} ${item.isDone ? "incomplete" : "complete"}`} disabled={saving} onClick={() => changeSubtask(item.key, { isDone: !item.isDone })} /> : <CompletionToggle kind="subtask" record={subtasks.find((subtask) => subtask.id === item.id)!} />}<span className={`min-w-0 flex-1 ${item.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}>{editing ? <InlineText label={`Subtask ${index + 1}`} value={item.title} placeholder="Subtask name" disabled={saving} autoFocus={!item.id} onChange={(title) => changeSubtask(item.key, { title })} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (item.title.trim()) addSubtask(); } }} /> : item.title}</span>{editing && <button aria-label={`Remove subtask ${index + 1}`} className="absolute right-0 rounded bg-[#fffdfc] p-1 text-[#8a837c] hover:text-[#b74131] focus:ring-2 focus:ring-[#d95d47] dark:bg-[#1e1c1a]" disabled={saving} onClick={() => setDraft((value) => ({ ...value, subtasks: value.subtasks.filter((next) => next.key !== item.key) }))} type="button"><X size={16} /></button>}</li>)}</ul>}
    </section>
    {error && <p className="mt-4 text-sm text-[#a13d2d] dark:text-[#ffad9b]" role="alert">{error}</p>}
  </PageFrame>;
}
