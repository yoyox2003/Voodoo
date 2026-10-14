import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../UI/Button";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import { useToast } from "../toast/useToast";
import type { Task } from "../types/entities";
import { PageFrame, WorkspacePageStatus } from "./PageState";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";

type CreateTaskForm = {
  bucketId: string;
  description: string;
  dueDate: string;
  importance: Task["importance"];
  name: string;
};

const importanceValues: Task["importance"][] = ["GREEN", "AMBER", "RED"];

function returnPath(state: unknown): string {
  if (typeof state === "object" && state !== null && "returnTo" in state) {
    const value = state.returnTo;
    if (typeof value === "string" && value.startsWith("/")) return value;
  }
  return "/";
}

export function TaskCreatePage() {
  const workspace = useWorkspaceOutlet();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const requestedBucketId = searchParams.get("bucketId") ?? "";
  const requestedDueDate = searchParams.get("dueDate") ?? "";
  const [form, setForm] = useState<CreateTaskForm>({
    bucketId: requestedBucketId,
    description: "",
    dueDate: requestedDueDate,
    importance: "GREEN",
    name: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const backTo = returnPath(location.state);

  const bucketsByFolder = useMemo(() => new Map(
    workspace.folders.map((folder) => [folder.id, workspace.buckets.filter((bucket) => bucket.folderId === folder.id)]),
  ), [workspace.buckets, workspace.folders]);

  // A URL can name a bucket that was deleted or belongs to another account.
  // Treat a stale preselection as empty without resetting the other form fields.
  const activeBucketId = workspace.buckets.some((bucket) => bucket.id === form.bucketId)
    ? form.bucketId
    : "";

  const createTask = useMutation({
    mutationFn: (nextForm: CreateTaskForm) => request<Task>(`/api/buckets/${nextForm.bucketId}/tasks`, {
      method: "POST",
      // The UI calls this field name "name" because that is what the existing
      // API accepts. The backend stores it as Task.title in the database.
      body: JSON.stringify({
        name: nextForm.name.trim(),
        description: nextForm.description.trim() || null,
        dueDate: nextForm.dueDate || null,
        importance: nextForm.importance,
      }),
    }),
    onSuccess: async (createdTask) => {
      // Updating the cache first makes every screen using /api/tasks reflect
      // the new task immediately; invalidation then confirms it with the API.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) => [createdTask, ...current]);
      await queryClient.invalidateQueries({ queryKey: tasksKey });
      toast.success("Task created successfully.");
      navigate(`/tasks/${createdTask.id}`, { replace: true });
    },
    onError: (error) => {
      setValidationError(error instanceof Error ? error.message : "Unable to create the task.");
    },
  });

  if (workspace.isLoading || workspace.isError) {
    return <PageFrame title="Create task"><WorkspacePageStatus {...workspace} /></PageFrame>;
  }

  const noBuckets = workspace.buckets.length === 0;

  function updateForm<Key extends keyof CreateTaskForm>(key: Key, value: CreateTaskForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setValidationError("Enter a task name.");
      return;
    }
    if (!activeBucketId) {
      setValidationError("Choose a bucket for this task.");
      return;
    }
    setValidationError(null);
    createTask.mutate({ ...form, bucketId: activeBucketId });
  }

  return (
    <PageFrame eyebrow="Task" title="Create task">
      <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">Give the task a home, then add any helpful details.</p>
      {noBuckets ? (
        <section className="mt-8 rounded-xl border border-[#efd5c7] bg-[#fff7f2] p-5 text-sm text-[#8c4435] dark:border-[#653f37] dark:bg-[#362522] dark:text-[#ffad9b]">
          <h2 className="font-semibold">Create a bucket first</h2>
          <p className="mt-2 leading-6">Tasks live inside buckets. Use the plus buttons in the sidebar to create a folder, then a bucket, before returning here.</p>
          <Button className="mt-4" onClick={() => navigate(backTo)} variant="secondary">Go back</Button>
        </section>
      ) : (
        <form className="mt-8 grid max-w-2xl gap-6" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
            Task name
            <input autoFocus className="rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none placeholder:text-[#a6a19b] focus:border-[#c84b37] focus:ring-2 focus:ring-[#c84b37]/15 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={createTask.isPending} onChange={(event) => updateForm("name", event.target.value)} placeholder="What needs to be done?" value={form.name} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
            Bucket
            <select className="rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none focus:border-[#c84b37] focus:ring-2 focus:ring-[#c84b37]/15 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={createTask.isPending} onChange={(event) => updateForm("bucketId", event.target.value)} value={activeBucketId}>
              <option value="">Choose a bucket</option>
              {workspace.folders.map((folder) => {
                const buckets = bucketsByFolder.get(folder.id) ?? [];
                return buckets.length > 0 ? <optgroup key={folder.id} label={folder.name}>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
            Description <span className="font-normal text-[#8b8580] dark:text-[#aaa29b]">Optional</span>
            <textarea className="min-h-28 rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none placeholder:text-[#a6a19b] focus:border-[#c84b37] focus:ring-2 focus:ring-[#c84b37]/15 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={createTask.isPending} onChange={(event) => updateForm("description", event.target.value)} placeholder="Add context, notes, or a useful next step…" value={form.description} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
            Due date <span className="font-normal text-[#8b8580] dark:text-[#aaa29b]">Optional</span>
            <input className="w-fit rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none focus:border-[#c84b37] focus:ring-2 focus:ring-[#c84b37]/15 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]" disabled={createTask.isPending} onChange={(event) => updateForm("dueDate", event.target.value)} type="date" value={form.dueDate} />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">Importance</legend>
            <div className="flex gap-2">
              {importanceValues.map((importance) => {
                const selected = form.importance === importance;
                const label = importanceLabels[importance];
                return <button aria-label={`Set importance to ${label}`} aria-pressed={selected} className={`grid h-9 w-9 place-items-center rounded-full outline-none transition hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#302d29] ${selected ? "ring-2 ring-[#353535] ring-offset-2 dark:ring-[#eee9e4] dark:ring-offset-[#1b1a18]" : ""}`} disabled={createTask.isPending} key={importance} onClick={() => updateForm("importance", importance)} title={`Set importance to ${label}`} type="button"><span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${importanceColorClasses[importance]}`} /></button>;
              })}
            </div>
          </fieldset>
          {validationError && <p className="rounded-lg border border-[#f1c7be] bg-[#fff2ef] px-3 py-2 text-sm text-[#a13d2d] dark:border-[#73463d] dark:bg-[#3d2722] dark:text-[#ffad9b]" role="alert">{validationError}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e9e5e2] pt-6 dark:border-[#393531]">
            <Button disabled={createTask.isPending} onClick={() => navigate(backTo)} variant="ghost">Cancel</Button>
            <Button disabled={createTask.isPending} type="submit">{createTask.isPending ? "Creating…" : "Create task"}</Button>
          </div>
        </form>
      )}
      <Link className="mt-8 inline-flex text-sm text-[#77716b] underline underline-offset-4 hover:text-[#c84b37] dark:text-[#aaa29b] dark:hover:text-[#ffad9b]" to={backTo}>Back</Link>
    </PageFrame>
  );
}
