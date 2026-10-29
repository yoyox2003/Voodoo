import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Link, useParams } from "react-router";
import { TaskMarker } from "../components/TaskMarker";
import { CompletionToggle } from "../components/CompletionToggle";
import { InlineWorkspaceName } from "../components/InlineWorkspaceName";
import { TaskControls } from "../components/TaskControls";
import { TaskImportance } from "../components/TaskImportance";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import type { Subtask, Task } from "../types/entities";
import { PageFrame, WorkspacePageStatus } from "./PageState";
import { Button } from "../UI/Button";
import { BucketDrop, SortableTask, TaskListOrder } from "../components/WorkspaceDrag";

function DeleteTaskDialog({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      aria-labelledby="delete-task-title"
      aria-describedby="delete-task-description"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-[#e9e5e2] bg-[#fffdfc] p-6 text-[#292827] shadow-2xl backdrop:bg-[#282522]/35 dark:border-[#413c38] dark:bg-[#252220] dark:text-[#f3efea]"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      ref={dialogRef}
    >
      <h2 className="text-lg font-semibold" id="delete-task-title">
        Delete task?
      </h2>
      <p
        className="mt-3 text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]"
        id="delete-task-description"
      >
        Delete “{name}” and its subtasks? This cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button autoFocus disabled={pending} onClick={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button disabled={pending} onClick={onConfirm} variant="danger">
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </dialog>
  );
}

type TaskGroupProps = { subtasks: Subtask[]; task: Task };

function TaskGroup({ subtasks, task }: TaskGroupProps) {
  const [showAllSubtasks, setShowAllSubtasks] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(task.title);
  const savingName = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const mutationKey = [...tasksKey, task.id, "update"];
  const isSaving = useIsMutating({ mutationKey }) > 0;

  const rename = useMutation({
    mutationKey,
    mutationFn: (nextName: string) =>
      request<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      }),
    onSuccess: (updatedTask) => {
      // The bucket, folder and task detail all read this shared task list.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((item) => (item.id === updatedTask.id ? updatedTask : item)),
      );
      setEditing(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to rename task."),
    onSettled: () => {
      savingName.current = false;
      if (queryClient.isMutating({ mutationKey: tasksKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: tasksKey });
      }
    },
  });

  const deleteTask = useMutation({
    mutationKey,
    mutationFn: () => request<void>(`/api/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => {
      // Deleting a task also deletes its subtasks on the server.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.filter((item) => item.id !== task.id),
      );
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) =>
        current.filter((item) => item.taskId !== task.id),
      );
      toast.success("Task deleted.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to delete task."),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tasksKey });
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
    },
  });

  function saveName() {
    if (savingName.current) return;
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Enter a task name.");
      return;
    }
    if (nextName === task.title) {
      setEditing(false);
      return;
    }
    // Enter and blur can happen together, so guard against saving twice.
    savingName.current = true;
    rename.mutate(nextName);
  }

  const visibleSubtasks = showAllSubtasks ? subtasks : subtasks.slice(0, 3);
  return (
    <section className="border-b border-[#e9e5e2] dark:border-[#393531]">
      <div className="flex min-h-12 items-center gap-3 py-2.5 text-[15px] font-medium">
        {subtasks.length > 0 ? (
          <button
            aria-controls={`task-subtasks-${task.id}`}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${task.title} subtasks`}
            className="shrink-0 rounded text-[#8a837c] hover:text-[#c84b37] focus-visible:ring-2 focus-visible:ring-[#d95d47] dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" size={16} />
            ) : (
              <ChevronRight aria-hidden="true" size={16} />
            )}
          </button>
        ) : (
          <span aria-hidden="true" className="w-4 shrink-0" />
        )}
        <CompletionToggle kind="task" record={task} />
        {editing ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <TaskImportance importance={task.importance} />
            <input
              aria-label={`Rename ${task.title}`}
              autoFocus
              className="min-w-0 flex-1 rounded-sm border-0 bg-[#fff6f1] p-0 text-[15px] font-medium outline-none disabled:opacity-60 dark:bg-[#332724]"
              disabled={rename.isPending}
              onBlur={saveName}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveName();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
              }}
              value={name}
            />
          </div>
        ) : (
          <Link
            viewTransition
            className="flex min-w-0 flex-1 items-center gap-3 hover:text-[#c84b37] dark:hover:text-[#ffad9b]"
            to={`/tasks/${task.id}`}
          >
            <TaskImportance importance={task.importance} />
            <span
              className={`truncate ${task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}
            >
              {task.title}
            </span>
          </Link>
        )}
        <div
          className="relative shrink-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              event.preventDefault();
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }
          }}
        >
          <button
            aria-expanded={menuOpen}
            aria-label={`Options for ${task.title}`}
            className="grid h-8 w-8 place-items-center rounded text-[#8a837c] transition-colors duration-150 hover:bg-[#f3f1ef] focus:outline-none motion-reduce:transition-none dark:text-[#aaa29b] dark:hover:bg-[#302d29]"
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuButtonRef}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" size={19} />
          </button>
          <div
            aria-hidden={!menuOpen}
            inert={!menuOpen}
            className={`absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[#dedad4] bg-white p-2 text-sm font-normal shadow-lg transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-[#494642] dark:bg-[#292724] ${menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}
          >
            <button
              className="w-full rounded px-2 py-2 text-left transition-colors duration-150 hover:bg-[#f3f1ef] focus:outline-none disabled:opacity-50 motion-reduce:transition-none dark:hover:bg-[#302d29]"
              disabled={isSaving}
              onClick={() => {
                setMenuOpen(false);
                setName(task.title);
                setEditing(true);
              }}
              type="button"
            >
              Rename
            </button>
            <div className="px-2 pt-2 text-xs text-[#77716b] dark:text-[#aaa29b]">
              Change importance
            </div>
            <TaskControls showCompletion={false} task={task} />
            <button
              className="w-full rounded px-2 py-2 text-left text-[#b74131] transition-colors duration-150 hover:bg-[#fff0ed] focus:outline-none disabled:opacity-50 motion-reduce:transition-none dark:text-[#ff9680] dark:hover:bg-[#482923]"
              disabled={isSaving}
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <DeleteTaskDialog
          name={task.title}
          pending={deleteTask.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteTask.mutate()}
        />
      )}
      {subtasks.length > 0 && (
        <div
          aria-hidden={!isExpanded}
          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          id={`task-subtasks-${task.id}`}
          inert={!isExpanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="ml-9 border-l border-[#e9e5e2] pb-3 pl-4 dark:border-[#393531]">
              <ul className="grid gap-0.5">
                {visibleSubtasks.map((subtask) => (
                  <li
                    className="flex items-center gap-2 py-1 text-sm text-[#716a64] dark:text-[#b9b1aa]"
                    key={subtask.id}
                  >
                    <TaskMarker done={subtask.isDone} />
                    <span
                      className={
                        subtask.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""
                      }
                    >
                      {subtask.title}
                    </span>
                  </li>
                ))}
              </ul>
              {subtasks.length > 3 && (
                <button
                  className="mt-2 text-sm font-medium text-[#c84b37] hover:underline dark:text-[#ffad9b]"
                  onClick={() => setShowAllSubtasks((current) => !current)}
                  type="button"
                >
                  {showAllSubtasks ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function InlineTaskCreator({ bucketId }: { bucketId: string }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const saving = useRef(false);
  const cancelled = useRef(false);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const tasksKey = apiQueryKey(userId, "/api/tasks");

  const create = useMutation({
    mutationFn: (taskName: string) =>
      request<Task>(`/api/buckets/${bucketId}/tasks`, {
        method: "POST",
        // The API accepts `name` and stores it as the task's `title`.
        body: JSON.stringify({ name: taskName }),
      }),
    onSuccess: (task) => {
      // All workspace pages use the same list, so the new task appears there too.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) => [
        task,
        ...current.filter((item) => item.id !== task.id),
      ]);
      setName("");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to create task."),
    onSettled: () => {
      saving.current = false;
    },
  });

  function finish() {
    if (saving.current || cancelled.current) return;
    const taskName = name.trim();
    if (!taskName) {
      setCreating(false);
      return;
    }
    // Enter and blur may occur together; send only one creation request.
    saving.current = true;
    create.mutate(taskName);
  }

  return (
    <>
      {creating && (
        <div className="flex min-h-12 items-center gap-3 border-b border-[#e9e5e2] py-2.5 text-[15px] font-medium dark:border-[#393531]">
          <span className="grid h-8 w-8 shrink-0 place-items-center">
            <TaskMarker />
          </span>
          <input
            aria-label="New task name"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-[#a6a19b] disabled:opacity-60"
            disabled={create.isPending}
            onBlur={finish}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                finish();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelled.current = true;
                setCreating(false);
              }
            }}
            placeholder="Task name"
            value={name}
          />
        </div>
      )}
      <button
        className="flex min-h-11 items-center gap-3 px-2 text-sm text-[#8a837c] transition-colors hover:text-[#c84b37] disabled:opacity-50 dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
        disabled={creating}
        onClick={() => {
          cancelled.current = false;
          setName("");
          setCreating(true);
        }}
        type="button"
      >
        <Plus aria-hidden="true" className="text-[#c84b37] dark:text-[#ff9d87]" size={18} />
        Add task
      </button>
    </>
  );
}

export function BucketPage() {
  const { bucketId } = useParams();
  const workspace = useWorkspaceOutlet();

  const bucket = workspace.buckets.find((item) => item.id === bucketId);

  if (workspace.isLoading || workspace.isError)
    return (
      <PageFrame title="Bucket">
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  if (!bucket)
    return (
      <PageFrame title="Bucket not found">
        <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">
          This bucket is unavailable.
        </p>
      </PageFrame>
    );

  const tasks = workspace.tasks.filter((task) => task.bucketId === bucket.id);
  return (
    <PageFrame
      backTo={`/folders/${bucket.folderId}`}
      backLabel="Back to folder"
      eyebrow="Bucket"
      title={<InlineWorkspaceName key={bucket.id} item={bucket} kind="bucket" />}
    >
      {bucket.description && (
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]">
          {bucket.description}
        </p>
      )}
      <section className="mt-10">
        <div className="flex h-9 items-center gap-2 border-b border-[#e9e5e2] text-[15px] font-semibold dark:border-[#393531]">
          <ChevronDown aria-hidden="true" size={16} /> Tasks{" "}
          <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span>
        </div>
        <BucketDrop bucketId={bucket.id}>
          <TaskListOrder tasks={tasks}>
            {tasks.map((task) => (
              <SortableTask key={task.id} task={task}>
                <TaskGroup
                  key={task.id}
                  subtasks={workspace.subtasks
                    .filter((subtask) => subtask.taskId === task.id)
                    .sort(
                      (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
                    )}
                  task={task}
                />
              </SortableTask>
            ))}
          </TaskListOrder>
        </BucketDrop>
        <InlineTaskCreator key={bucket.id} bucketId={bucket.id} />
      </section>
    </PageFrame>
  );
}
