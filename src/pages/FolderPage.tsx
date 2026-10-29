import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Link, useParams } from "react-router";
import { CompletionToggle } from "../components/CompletionToggle";
import { CompletionProgress } from "../components/CompletionProgress";
import { InlineWorkspaceName } from "../components/InlineWorkspaceName";
import { ScrollArea } from "../components/ScrollArea";
import { TaskImportance } from "../components/TaskImportance";
import { BucketDrop, SortableTask, TaskListOrder } from "../components/WorkspaceDrag";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import { bucketProgress, taskProgress } from "../lib/completionProgress";
import type { Bucket, Subtask, Task } from "../types/entities";
import { Button } from "../UI/Button";
import { PageFrame, WorkspacePageStatus } from "./PageState";

const bucketColumnsQuery = "(min-width: 768px)";

function subscribeToBucketColumns(onChange: () => void) {
  const media = window.matchMedia(bucketColumnsQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function BucketHeading({ bucket, tasks, subtasks, isExpanded, onToggle }: {
  bucket: Bucket; tasks: Task[]; subtasks: Subtask[]; isExpanded: boolean; onToggle: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bucket.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saving = useRef(false);
  const cancelBlur = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const bucketsKey = apiQueryKey(userId, "/api/buckets");
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");

  useEffect(() => {
    if (!confirmDelete) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [confirmDelete]);

  const rename = useMutation({
    mutationFn: (nextName: string) => request<Bucket>(`/api/buckets/${bucket.id}`, {
      method: "PUT", body: JSON.stringify({ name: nextName }),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Bucket[]>(bucketsKey, (current = []) =>
        current.map((item) => item.id === updated.id ? updated : item));
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: bucketsKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to rename bucket."),
    onSettled: () => { saving.current = false; },
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`/api/buckets/${bucket.id}`, { method: "DELETE" }),
    onSuccess: () => {
      const taskIds = new Set(tasks.map((task) => task.id));
      queryClient.setQueryData<Bucket[]>(bucketsKey, (current = []) => current.filter((item) => item.id !== bucket.id));
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) => current.filter((task) => task.bucketId !== bucket.id));
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) => current.filter((subtask) => !taskIds.has(subtask.taskId)));
      toast.success("Bucket deleted.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to delete bucket."),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bucketsKey });
      void queryClient.invalidateQueries({ queryKey: tasksKey });
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
    },
  });

  function saveName() {
    if (saving.current || cancelBlur.current) return;
    const nextName = name.trim();
    if (!nextName) { toast.error("Enter a bucket name."); return; }
    if (nextName === bucket.name) { setEditing(false); return; }
    saving.current = true;
    rename.mutate(nextName);
  }

  return <>
    <div className="flex min-h-9 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <button aria-controls={`folder-bucket-tasks-${bucket.id}`} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${bucket.name}`} className="rounded text-[#8a837c] hover:text-[#c84b37] focus-visible:ring-2 focus-visible:ring-[#d95d47] dark:text-[#aaa29b] dark:hover:text-[#ffad9b]" onClick={onToggle} type="button">
          {isExpanded ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
        </button>
        {editing ? <input aria-label={`Rename ${bucket.name}`} autoFocus className="min-w-0 rounded-sm border-0 bg-[#fff6f1] p-0 text-[15px] font-semibold outline-none disabled:opacity-60 dark:bg-[#332724]" disabled={rename.isPending} onBlur={saveName} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") { event.preventDefault(); saveName(); }
          if (event.key === "Escape") { event.preventDefault(); cancelBlur.current = true; setEditing(false); }
        }} value={name} /> : <Link viewTransition className="flex min-w-0 items-center gap-2 text-[15px] font-semibold hover:text-[#c84b37] dark:hover:text-[#ffad9b]" to={`/buckets/${bucket.id}`}><span className="truncate">{bucket.name}</span><span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span></Link>}
      </div>
      <CompletionProgress label={`${bucket.name} progress`} value={bucketProgress(tasks, subtasks)} />
      <div className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }} onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) { event.preventDefault(); setMenuOpen(false); menuButtonRef.current?.focus(); }
      }}>
        <button aria-expanded={menuOpen} aria-label={`Options for ${bucket.name}`} className="grid h-8 w-8 place-items-center rounded text-[#8a837c] transition-colors duration-150 hover:bg-[#f3f1ef] focus:outline-none motion-reduce:transition-none dark:text-[#aaa29b] dark:hover:bg-[#302d29]" onClick={() => setMenuOpen((open) => !open)} ref={menuButtonRef} type="button"><MoreHorizontal aria-hidden="true" size={19} /></button>
        <div aria-hidden={!menuOpen} inert={!menuOpen} className={`absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[#dedad4] bg-white p-2 text-sm font-normal shadow-lg transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-[#494642] dark:bg-[#292724] ${menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
          <button className="w-full rounded px-2 py-2 text-left transition-colors duration-150 hover:bg-[#f3f1ef] focus:outline-none motion-reduce:transition-none dark:hover:bg-[#302d29]" onClick={() => { setMenuOpen(false); cancelBlur.current = false; setName(bucket.name); setEditing(true); }} type="button">Rename</button>
          <button className="w-full rounded px-2 py-2 text-left text-[#b74131] transition-colors duration-150 hover:bg-[#fff0ed] focus:outline-none motion-reduce:transition-none dark:text-[#ff9680] dark:hover:bg-[#482923]" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} type="button">Delete</button>
        </div>
      </div>
    </div>
    {confirmDelete && <dialog aria-labelledby="delete-bucket-title" aria-describedby="delete-bucket-description" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-[#e9e5e2] bg-[#fffdfc] p-6 text-[#292827] shadow-2xl backdrop:bg-[#282522]/35 dark:border-[#413c38] dark:bg-[#252220] dark:text-[#f3efea]" onCancel={(event) => { event.preventDefault(); if (!remove.isPending) setConfirmDelete(false); }} ref={dialogRef}>
      <h2 className="text-lg font-semibold" id="delete-bucket-title">Delete bucket?</h2>
      <p className="mt-3 text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]" id="delete-bucket-description">Delete “{bucket.name}” and all its tasks and subtasks? This cannot be undone.</p>
      <div className="mt-6 flex justify-end gap-3"><Button autoFocus disabled={remove.isPending} onClick={() => setConfirmDelete(false)} variant="ghost">Cancel</Button><Button disabled={remove.isPending} onClick={() => remove.mutate()} variant="danger">{remove.isPending ? "Deleting…" : "Delete"}</Button></div>
    </dialog>}
  </>;
}

function InlineBucketCreator({ folderId }: { folderId: string }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const saving = useRef(false);
  const cancelled = useRef(false);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const bucketsKey = apiQueryKey(userId, "/api/buckets");

  const create = useMutation({
    mutationFn: (bucketName: string) => request<Bucket>(`/api/folders/${folderId}/buckets`, {
      method: "POST",
      body: JSON.stringify({ name: bucketName }),
    }),
    onSuccess: (bucket) => {
      // The folder page and sidebar share this cache, so both update together.
      queryClient.setQueryData<Bucket[]>(bucketsKey, (current = []) => [
        bucket,
        ...current.filter((item) => item.id !== bucket.id),
      ]);
      setName("");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: bucketsKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create bucket."),
    onSettled: () => { saving.current = false; },
  });

  function finish() {
    if (saving.current || cancelled.current) return;
    const bucketName = name.trim();
    if (!bucketName) {
      setCreating(false);
      return;
    }
    // Enter and blur can happen together, so only send one request.
    saving.current = true;
    create.mutate(bucketName);
  }

  return (
    <div className="mt-6">
      {creating && (
        <div className="flex min-h-12 items-center gap-2 rounded-md border border-[#e9e5e2] px-4 text-[15px] font-semibold dark:border-[#393531]">
          <ChevronDown aria-hidden="true" className="text-[#8a837c]" size={16} />
          <input
            aria-label="New bucket name"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-[#a6a19b] disabled:opacity-60"
            disabled={create.isPending}
            onBlur={finish}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") { event.preventDefault(); finish(); }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelled.current = true;
                setCreating(false);
              }
            }}
            placeholder="Bucket name"
            value={name}
          />
        </div>
      )}
      <button
        className="flex min-h-11 items-center gap-3 px-2 text-sm text-[#8a837c] transition-colors hover:text-[#c84b37] disabled:opacity-50 dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
        disabled={creating}
        onClick={() => { cancelled.current = false; setName(""); setCreating(true); }}
        type="button"
      >
        <Plus aria-hidden="true" className="text-[#c84b37] dark:text-[#ff9d87]" size={18} />
        Create bucket
      </button>
    </div>
  );
}

export function FolderPage() {
  const { folderId } = useParams();
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(() => new Set());
  const twoColumns = useSyncExternalStore(subscribeToBucketColumns, () => window.matchMedia(bucketColumnsQuery).matches, () => false);
  const workspace = useWorkspaceOutlet();
  const folder = workspace.folders.find((item) => item.id === folderId);
  if (workspace.isLoading || workspace.isError)
    return (
      <PageFrame title="Folder">
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  if (!folder)
    return (
      <PageFrame title="Folder not found">
        <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">
          This folder is unavailable.
        </p>
      </PageFrame>
    );

  const buckets = workspace.buckets.filter((bucket) => bucket.folderId === folder.id);
  const bucketCards = buckets.map((bucket) => {
            const tasks = workspace.tasks.filter((task) => task.bucketId === bucket.id);
            const isExpanded = !collapsedBuckets.has(bucket.id);
            return (
              <section className="min-w-0 rounded-md border border-[#e9e5e2] p-4 dark:border-[#393531]" key={bucket.id}>
                <BucketHeading bucket={bucket} tasks={tasks} subtasks={workspace.subtasks} isExpanded={isExpanded} onToggle={() =>
                  setCollapsedBuckets((current) => {
                    const next = new Set(current);
                    if (next.has(bucket.id)) next.delete(bucket.id);
                    else next.add(bucket.id);
                    return next;
                  })
                } />
                <div
                  aria-hidden={!isExpanded}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  id={`folder-bucket-tasks-${bucket.id}`}
                  inert={!isExpanded}
                >
                  <div className="min-h-0 overflow-hidden">
                    <BucketDrop bucketId={bucket.id}>
                      <TaskListOrder tasks={tasks}>
                        {tasks.length === 0 ? (
                          <p className="px-9 py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">
                            No tasks yet.
                          </p>
                        ) : (
                          <ScrollArea enabled={tasks.length > 5} expanded={isExpanded} label={`Tasks in ${bucket.name}`} maxHeightClass="max-h-[19.375rem]">
                          <ul className="grid gap-2 pt-2">
                            {tasks.map((task) => (
                              <li key={task.id}>
                                <SortableTask task={task}>
                                  <div className="flex min-h-12 items-center gap-3 py-2.5">
                                    <CompletionToggle kind="task" record={task} />
                                    <Link
                                      viewTransition
                                      className="flex min-w-0 flex-1 items-center gap-3 text-[15px] hover:text-[#c84b37] dark:hover:text-[#ffad9b]"
                                      to={`/tasks/${task.id}`}
                                    >
                                      <TaskImportance importance={task.importance} />
                                      <span
                                        className={`min-w-0 truncate ${task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}
                                      >
                                        {task.title}
                                      </span>
                                    </Link>
                                    <CompletionProgress label={`${task.title} progress`} value={taskProgress(task, workspace.subtasks.filter((subtask) => subtask.taskId === task.id))} />
                                  </div>
                                </SortableTask>
                              </li>
                            ))}
                          </ul>
                          </ScrollArea>
                        )}
                      </TaskListOrder>
                    </BucketDrop>
                  </div>
                </div>
              </section>
            );
          });

  return (
    <PageFrame
      eyebrow="Folder"
      title={<InlineWorkspaceName key={folder.id} item={folder} kind="folder" />}
      wide
    >
      {buckets.length === 0 ? (
        <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">
          This folder has no buckets yet.
        </p>
      ) : twoColumns && buckets.length > 1 ? (
        <div className="mt-10 grid grid-cols-2 items-start gap-6">
          <div className="grid min-w-0 gap-6">{bucketCards.filter((_, index) => index % 2 === 0)}</div>
          <div className="grid min-w-0 gap-6">{bucketCards.filter((_, index) => index % 2 === 1)}</div>
        </div>
      ) : (
        <div className="mt-10 grid gap-6">{bucketCards}</div>
      )}
      <InlineBucketCreator key={folder.id} folderId={folder.id} />
    </PageFrame>
  );
}
