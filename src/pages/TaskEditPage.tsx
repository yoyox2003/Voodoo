import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../UI/Button";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { dueDateKey } from "../lib/dueDates";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import { useToast } from "../toast/useToast";
import type { Subtask, Task } from "../types/entities";
import { PageFrame, WorkspacePageStatus } from "./PageState";

type TaskForm = {
  description: string;
  dueDate: string;
  importance: Task["importance"];
  isDone: boolean;
  name: string;
};

const importanceValues: Task["importance"][] = ["GREEN", "AMBER", "RED"];

type EditableSubtask = {
  id?: string;
  key: string;
  originalTitle?: string;
  title: string;
};

type SaveResult = {
  createdSubtasks: Subtask[];
  deletedSubtaskIds: string[];
  updatedSubtasks: Subtask[];
  updatedTask: Task;
};

function TaskEditForm({ task, subtasks }: { task: Task; subtasks: Subtask[] }) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");
  const [form, setForm] = useState<TaskForm>(() => ({
    description: task.description ?? "",
    dueDate: dueDateKey(task.dueDate) ?? "",
    importance: task.importance,
    isDone: task.isDone,
    name: task.title,
  }));
  const [editedSubtasks, setEditedSubtasks] = useState<EditableSubtask[]>(() =>
    subtasks.map((subtask) => ({
      id: subtask.id,
      key: subtask.id,
      originalTitle: subtask.title,
      title: subtask.title,
    })),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const saveChanges = useMutation({
    mutationFn: async (): Promise<SaveResult> => {
      // One partial PATCH saves the editable Task columns. The API's `name`
      // field is intentionally mapped to Prisma's Task.title on the backend.
      const updatedTask = await request<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          dueDate: form.dueDate || null,
          importance: form.importance,
          // Keep the existing completion state unless the checkbox changes it.
          // Sending false explicitly is how a completed task is reopened.
          isDone: form.isDone,
        }),
      });

      const keptIds = new Set(editedSubtasks.flatMap((subtask) => subtask.id ? [subtask.id] : []));
      const deletedSubtaskIds = subtasks
        .filter((subtask) => !keptIds.has(subtask.id))
        .map((subtask) => subtask.id);
      const renamedSubtasks = editedSubtasks.filter(
        (subtask): subtask is EditableSubtask & { id: string; originalTitle: string } =>
          Boolean(subtask.id) && subtask.title.trim() !== subtask.originalTitle,
      );
      const newSubtasks = editedSubtasks.filter((subtask) => !subtask.id);

      // After the task is valid and saved, these independent subtask requests
      // run together. Each request still uses the backend ownership checks.
      const [updatedSubtasks, createdSubtasks] = await Promise.all([
        Promise.all(renamedSubtasks.map((subtask) => request<Subtask>(`/api/subtasks/${subtask.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: subtask.title.trim() }),
        }))),
        Promise.all(newSubtasks.map((subtask) => request<Subtask>(`/api/tasks/${task.id}/subtasks`, {
          method: "POST",
          body: JSON.stringify({ name: subtask.title.trim() }),
        }))),
        Promise.all(deletedSubtaskIds.map((id) => request<void>(`/api/subtasks/${id}`, { method: "DELETE" }))),
      ]);

      return { createdSubtasks, deletedSubtaskIds, updatedSubtasks, updatedTask };
    },
    onSuccess: async ({ createdSubtasks, deletedSubtaskIds, updatedSubtasks, updatedTask }) => {
      // Replace cache entries with API responses so the bucket, folder, and
      // task pages immediately agree about the saved task and its subtasks.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((item) => item.id === updatedTask.id ? updatedTask : item),
      );
      const deletedIds = new Set(deletedSubtaskIds);
      const updatedById = new Map(updatedSubtasks.map((subtask) => [subtask.id, subtask]));
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) => [
        ...createdSubtasks,
        ...current
          .filter((subtask) => !deletedIds.has(subtask.id))
          .map((subtask) => updatedById.get(subtask.id) ?? subtask),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksKey }),
        queryClient.invalidateQueries({ queryKey: subtasksKey }),
      ]);
      toast.success("Task changes saved.");
      navigate(`/tasks/${task.id}`, { replace: true });
    },
    onError: (error) => {
      // The form state is not replaced on failure, so the user can correct an
      // error and try again. Cache invalidation fetches any partial save safely.
      void queryClient.invalidateQueries({ queryKey: tasksKey });
      void queryClient.invalidateQueries({ queryKey: subtasksKey });
      setValidationError(error instanceof Error ? error.message : "Unable to save task changes.");
    },
  });

  function updateForm<Key extends keyof TaskForm>(key: Key, value: TaskForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSubtask(key: string, title: string) {
    setEditedSubtasks((current) => current.map((subtask) =>
      subtask.key === key ? { ...subtask, title } : subtask,
    ));
  }

  function removeSubtask(key: string) {
    setEditedSubtasks((current) => current.filter((subtask) => subtask.key !== key));
  }

  function addSubtask() {
    setEditedSubtasks((current) => [
      ...current,
      { key: `new-${crypto.randomUUID()}`, title: "" },
    ]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setValidationError("Enter a task name.");
      return;
    }
    if (editedSubtasks.some((subtask) => !subtask.title.trim())) {
      setValidationError("Give every subtask a name or remove the empty row.");
      return;
    }
    setValidationError(null);
    saveChanges.mutate();
  }

  return (
    <PageFrame backTo={`/tasks/${task.id}`} backLabel="Back to task" eyebrow="Task" title="Edit task">
      <form className="mt-8 grid max-w-2xl gap-6" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
          Task name
          <input autoFocus className="rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={saveChanges.isPending} onChange={(event) => updateForm("name", event.target.value)} value={form.name} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
          Description <span className="font-normal text-[#8b8580] dark:text-[#aaa29b]">Optional</span>
          <textarea className="min-h-28 rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={saveChanges.isPending} onChange={(event) => updateForm("description", event.target.value)} value={form.description} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
          Due date <span className="font-normal text-[#8b8580] dark:text-[#aaa29b]">Optional</span>
          <input className="w-fit rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={saveChanges.isPending} onChange={(event) => updateForm("dueDate", event.target.value)} type="date" value={form.dueDate} />
        </label>
        <label className="flex w-fit items-center gap-3 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
          <input checked={form.isDone} className="h-4 w-4 accent-[#c84b37]" disabled={saveChanges.isPending} onChange={(event) => updateForm("isDone", event.target.checked)} type="checkbox" />
          Mark task as completed
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">Importance</legend>
          <div className="flex gap-2">
            {importanceValues.map((importance) => {
              const selected = form.importance === importance;
              const label = importanceLabels[importance];
              return <button aria-label={`Set importance to ${label}`} aria-pressed={selected} className={`grid h-9 w-9 place-items-center rounded-full outline-none transition hover:bg-[#f3f1ef] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#302d29] ${selected ? "ring-2 ring-[#353535] ring-offset-2 dark:ring-[#eee9e4] dark:ring-offset-[#1b1a18]" : ""}`} disabled={saveChanges.isPending} key={importance} onClick={() => updateForm("importance", importance)} title={`Set importance to ${label}`} type="button"><span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${importanceColorClasses[importance]}`} /></button>;
            })}
          </div>
        </fieldset>
        <section className="grid gap-3 border-t border-[#e9e5e2] pt-6 dark:border-[#393531]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Subtasks</h2>
            <Button disabled={saveChanges.isPending} onClick={addSubtask} variant="secondary">Add subtask</Button>
          </div>
          {editedSubtasks.length === 0 ? <p className="text-sm text-[#77716b] dark:text-[#aaa29b]">Add smaller steps if this task needs them.</p> : (
            <div className="grid gap-3">
              {editedSubtasks.map((subtask, index) => (
                <div className="flex items-center gap-3" key={subtask.key}>
                  <input aria-label={`Subtask ${index + 1}`} className="min-w-0 flex-1 rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={saveChanges.isPending} onChange={(event) => updateSubtask(subtask.key, event.target.value)} value={subtask.title} />
                  <Button aria-label={`Remove subtask ${index + 1}`} disabled={saveChanges.isPending} onClick={() => removeSubtask(subtask.key)} variant="danger">Remove</Button>
                </div>
              ))}
            </div>
          )}
        </section>
        {validationError && <p className="rounded-lg border border-[#f1c7be] bg-[#fff2ef] px-3 py-2 text-sm text-[#a13d2d] dark:border-[#73463d] dark:bg-[#3d2722] dark:text-[#ffad9b]" role="alert">{validationError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#e9e5e2] pt-6 dark:border-[#393531]">
          <Button disabled={saveChanges.isPending} onClick={() => navigate(`/tasks/${task.id}`)} variant="ghost">Cancel</Button>
          <Button disabled={saveChanges.isPending} type="submit">{saveChanges.isPending ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </PageFrame>
  );
}

export function TaskEditPage() {
  const { taskId } = useParams();
  const workspace = useWorkspaceOutlet();
  const task = workspace.tasks.find((item) => item.id === taskId);

  if (workspace.isLoading || workspace.isError) {
    return <PageFrame title="Edit task"><WorkspacePageStatus {...workspace} /></PageFrame>;
  }
  if (!task) {
    return <PageFrame title="Task not found"><p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">This task is unavailable.</p></PageFrame>;
  }

  return <TaskEditForm key={task.id} task={task} subtasks={workspace.subtasks.filter((subtask) => subtask.taskId === task.id)} />;
}
