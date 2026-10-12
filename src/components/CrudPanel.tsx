import { useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../UI/Button";
import { TextField } from "../UI/TextField";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { ApiError } from "../lib/api";
import { useToast } from "../toast/useToast";
import type { EntityKind, EntityRecord } from "../types/entities";
import { entityLabels, recordName } from "../types/entities";
import { ApiRecordRow } from "./ApiRecordRow";

type CrudPanelProps = {
  activeEntity: EntityKind;
};

type MutationSnapshot = {
  previousRecords: EntityRecord[] | undefined;
  temporaryId?: string;
};

const listPaths: Record<EntityKind, string> = {
  folder: "/api/folders",
  bucket: "/api/buckets",
  task: "/api/tasks",
  subtask: "/api/subtasks",
};

const parentDetails: Partial<Record<EntityKind, { label: string; path: string }>> = {
  bucket: { label: "Folder", path: listPaths.folder },
  task: { label: "Bucket", path: listPaths.bucket },
  subtask: { label: "Task", path: listPaths.task },
};

function messageFrom(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something unexpected went wrong.";
}

// Query keys describe exactly which cached server data a component needs. The
// Clerk user ID is included so a second account never reads the first account's cache.
function apiQueryKey(userId: string | null | undefined, path: string) {
  return ["api", userId, path] as const;
}

function renamedRecord(record: EntityRecord, nextName: string): EntityRecord {
  return "name" in record ? { ...record, name: nextName } : { ...record, title: nextName };
}

function optimisticRecord(
  entity: EntityKind,
  name: string,
  parentId: string,
  temporaryId: string,
): EntityRecord {
  const createdAt = new Date().toISOString();

  if (entity === "folder") {
    return { id: temporaryId, name, userId: "", createdAt };
  }

  if (entity === "bucket") {
    return { id: temporaryId, name, description: null, folderId: parentId, createdAt };
  }

  if (entity === "task") {
    return {
      id: temporaryId,
      title: name,
      description: null,
      dueDate: null,
      importance: "GREEN",
      isDone: false,
      bucketId: parentId,
      createdAt,
    };
  }

  return { id: temporaryId, title: name, isDone: false, taskId: parentId, createdAt };
}

export function CrudPanel({ activeEntity }: CrudPanelProps) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const detail = parentDetails[activeEntity];
  const recordsPath = listPaths[activeEntity];
  const recordsKey = apiQueryKey(userId, recordsPath);
  const parentsKey = apiQueryKey(userId, detail?.path ?? "parent-list-not-needed");
  const canRequest = isLoaded && isSignedIn && Boolean(userId);

  // useQuery replaces the former effect and loading state. It keeps the list
  // in the shared cache and exposes loading, error, and explicit refetch state.
  const recordsQuery = useQuery({
    queryKey: recordsKey,
    queryFn: () => request<EntityRecord[]>(recordsPath),
    enabled: canRequest,
  });

  // Child records need their parent list for the select input. This is a
  // separate query so a cached parent list can be reused by another tab.
  const parentsQuery = useQuery({
    queryKey: parentsKey,
    queryFn: () => request<EntityRecord[]>(detail!.path),
    enabled: canRequest && Boolean(detail),
  });

  const records = recordsQuery.data ?? [];
  const parents = detail ? parentsQuery.data ?? [] : [];

  async function refreshPanel() {
    // Parent and record lists are independent API requests, so refetch them in
    // parallel instead of waiting for one network request before starting another.
    await Promise.all([
      recordsQuery.refetch(),
      ...(detail ? [parentsQuery.refetch()] : []),
    ]);
  }

  async function reconcileCache() {
    // Mutating any level can affect a child dropdown or a displayed list. The
    // user-scoped prefix refreshes active related queries without touching another account's cache.
    await queryClient.invalidateQueries({ queryKey: ["api", userId] });
  }

  const createMutation = useMutation({
    mutationFn: ({ path, recordName: newName }: { path: string; recordName: string }) =>
      request<EntityRecord>(path, { method: "POST", body: JSON.stringify({ name: newName }) }),
    onMutate: async ({ recordName: newName }) => {
      await queryClient.cancelQueries({ queryKey: recordsKey });
      const previousRecords = queryClient.getQueryData<EntityRecord[]>(recordsKey);
      const temporaryId = `optimistic-${crypto.randomUUID()}`;

      // Show a temporary record immediately. If the API rejects the request,
      // onError below restores previousRecords, which is the optimistic rollback.
      queryClient.setQueryData<EntityRecord[]>(recordsKey, (current = []) => [
        ...current,
        optimisticRecord(activeEntity, newName, parentId, temporaryId),
      ]);

      return { previousRecords, temporaryId } satisfies MutationSnapshot;
    },
    onSuccess: (createdRecord, _variables, context) => {
      queryClient.setQueryData<EntityRecord[]>(recordsKey, (current = []) =>
        current.map((record) =>
          record.id === context?.temporaryId ? createdRecord : record,
        ),
      );
      setName("");
      toast.success(`${entityLabels[activeEntity].slice(0, -1)} created successfully.`);
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(recordsKey, context?.previousRecords);
      toast.error(messageFrom(error));
    },
    onSettled: reconcileCache,
  });

  const renameMutation = useMutation({
    mutationFn: ({ record, nextName }: { record: EntityRecord; nextName: string }) =>
      request<EntityRecord>(`${recordsPath}/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName }),
      }),
    onMutate: async ({ record, nextName }) => {
      await queryClient.cancelQueries({ queryKey: recordsKey });
      const previousRecords = queryClient.getQueryData<EntityRecord[]>(recordsKey);
      queryClient.setQueryData<EntityRecord[]>(recordsKey, (current = []) =>
        current.map((currentRecord) =>
          currentRecord.id === record.id ? renamedRecord(currentRecord, nextName) : currentRecord,
        ),
      );
      return { previousRecords } satisfies MutationSnapshot;
    },
    onSuccess: () => toast.success(`${entityLabels[activeEntity].slice(0, -1)} renamed successfully.`),
    onError: (error, _variables, context) => {
      queryClient.setQueryData(recordsKey, context?.previousRecords);
      toast.error(messageFrom(error));
    },
    onSettled: reconcileCache,
  });

  const deleteMutation = useMutation({
    mutationFn: (record: EntityRecord) =>
      request<void>(`${recordsPath}/${record.id}`, { method: "DELETE" }),
    onMutate: async (record) => {
      await queryClient.cancelQueries({ queryKey: recordsKey });
      const previousRecords = queryClient.getQueryData<EntityRecord[]>(recordsKey);
      queryClient.setQueryData<EntityRecord[]>(recordsKey, (current = []) =>
        current.filter((currentRecord) => currentRecord.id !== record.id),
      );
      return { previousRecords } satisfies MutationSnapshot;
    },
    onSuccess: () => toast.success(`${entityLabels[activeEntity].slice(0, -1)} deleted successfully.`),
    onError: (error, _record, context) => {
      queryClient.setQueryData(recordsKey, context?.previousRecords);
      toast.error(messageFrom(error));
    },
    onSettled: reconcileCache,
  });

  function createPath(): string {
    if (activeEntity === "folder") return listPaths.folder;
    if (activeEntity === "bucket") return `/api/folders/${parentId}/buckets`;
    if (activeEntity === "task") return `/api/buckets/${parentId}/tasks`;
    return `/api/tasks/${parentId}/subtasks`;
  }

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name before creating the record.");
      return;
    }

    if (detail && !parentId) {
      toast.error(`Choose a ${detail.label.toLowerCase()} before creating this record.`);
      return;
    }

    try {
      await createMutation.mutateAsync({ path: createPath(), recordName: name.trim() });
    } catch {
      // onError already restores the snapshot and turns the API error into UI text.
    }
  }

  async function renameRecord(record: EntityRecord, nextName: string) {
    try {
      await renameMutation.mutateAsync({ record, nextName: nextName.trim() });
    } catch {
      // onError has restored the original cached list.
    }
  }

  async function deleteRecord(record: EntityRecord) {
    try {
      await deleteMutation.mutateAsync(record);
    } catch {
      // onError has restored the deleted row if the backend rejects deletion.
    }
  }

  const initialLoading = recordsQuery.isPending && !recordsQuery.data;
  const isRefreshing = recordsQuery.isFetching || (Boolean(detail) && parentsQuery.isFetching);
  const queryError = recordsQuery.error ?? (detail ? parentsQuery.error : null);
  const error = queryError ? messageFrom(queryError) : null;
  const isMutating =
    createMutation.isPending || renameMutation.isPending || deleteMutation.isPending;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-5 border-b border-[#efebe7] pb-7 dark:border-[#383531] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#d95d47]">CRUD TESTER</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{entityLabels[activeEntity]}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#77716b] dark:text-[#aaa29b]">
            Create a record, edit its name, or remove it to check the current Express route behavior.
          </p>
        </div>
        <Button disabled={isRefreshing || isMutating} onClick={() => void refreshPanel()} variant="secondary">
          {isRefreshing ? "Refreshing…" : "Refresh list"}
        </Button>
      </div>

      <section className="mt-8 rounded-2xl border border-[#e7e2dc] bg-[#fffefd] p-5 shadow-sm dark:border-[#403c38] dark:bg-[#242220] dark:shadow-none sm:p-6">
        <h2 className="text-lg font-bold">Create {entityLabels[activeEntity].slice(0, -1)}</h2>
        <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={createRecord}>
          <TextField
            label={`${entityLabels[activeEntity].slice(0, -1)} name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={`New ${entityLabels[activeEntity].slice(0, -1).toLowerCase()}…`}
            value={name}
          />

          {detail && (
            <label className="grid gap-1.5 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]">
              {detail.label}
              <select
                className="rounded-lg border border-[#dedad4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#d95d47] focus:ring-2 focus:ring-[#d95d47]/20 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]"
                disabled={parentsQuery.isPending}
                onChange={(event) => setParentId(event.target.value)}
                value={parentId}
              >
                <option value="">
                  {parentsQuery.isPending
                    ? `Loading ${detail.label.toLowerCase()}s…`
                    : `Choose a ${detail.label.toLowerCase()}`}
                </option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {recordName(parent)} ({parent.id.slice(0, 6)}…)
                  </option>
                ))}
              </select>
            </label>
          )}

          <Button className="sm:self-end" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>

        {detail && parentsQuery.isSuccess && parents.length === 0 && !parentsQuery.isFetching && (
          <p className="mt-4 rounded-lg bg-[#fff5f1] px-3 py-2 text-sm text-[#a14a3a] dark:bg-[#432922] dark:text-[#ffad9b]">
            Create a {detail.label.toLowerCase()} first, then return here to add a child record.
          </p>
        )}
      </section>

      {error && (
        <p className="mt-6 rounded-xl border border-[#f1c7be] bg-[#fff2ef] px-4 py-3 text-sm text-[#a13d2d] dark:border-[#73463d] dark:bg-[#3d2722] dark:text-[#ffad9b]" role="alert">
          {error}
        </p>
      )}
      <section className="mt-8">
        <div className="flex items-center justify-between border-b border-[#efebe7] pb-3 dark:border-[#383531]">
          <h2 className="text-lg font-bold">Current records</h2>
          <span className="text-sm text-[#8b8580] dark:text-[#aaa29b]">{records.length} total</span>
        </div>

        {initialLoading ? (
          <p className="py-8 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading records from the backend…</p>
        ) : recordsQuery.isError && records.length === 0 ? (
          <p className="py-8 text-sm text-[#77716b] dark:text-[#aaa29b]">Unable to load records. Use Refresh list to try again.</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-sm text-[#77716b] dark:text-[#aaa29b]">No records yet. Use the form above to create the first one.</p>
        ) : (
          <ul>
            {records.map((record) => (
              <ApiRecordRow
                key={record.id}
                onDelete={deleteRecord}
                onRename={renameRecord}
                record={record}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
