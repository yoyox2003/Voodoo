import { useCallback, useEffect, useState } from "react";
import { Button } from "../UI/Button";
import { TextField } from "../UI/TextField";
import { ApiError } from "../lib/api";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import type {
  Bucket,
  EntityKind,
  EntityRecord,
  Folder,
  Subtask,
  Task,
} from "../types/entities";
import { entityLabels, recordName } from "../types/entities";
import { ApiRecordRow } from "./ApiRecordRow";

type CrudPanelProps = {
  activeEntity: EntityKind;
};

const listPaths: Record<EntityKind, string> = {
  folder: "/api/folders",
  bucket: "/api/buckets",
  task: "/api/tasks",
  subtask: "/api/subtasks",
};

const parentDetails: Partial<Record<EntityKind, { label: string; plural: string }>> = {
  bucket: { label: "Folder", plural: "folders" },
  task: { label: "Bucket", plural: "buckets" },
  subtask: { label: "Task", plural: "tasks" },
};

function messageFrom(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something unexpected went wrong.";
}

export function CrudPanel({ activeEntity }: CrudPanelProps) {
  const request = useAuthenticatedApi();
  const [records, setRecords] = useState<EntityRecord[]>([]);
  const [parents, setParents] = useState<EntityRecord[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A bucket, task, or subtask needs a parent. We load that parent list beside
  // the active records so the form can offer a real dropdown instead of asking
  // you to copy and paste database IDs.
  const loadPanel = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (activeEntity === "folder") {
        setRecords(await request<Folder[]>(listPaths.folder));
        setParents([]);
      }

      if (activeEntity === "bucket") {
        const [buckets, folders] = await Promise.all([
          request<Bucket[]>(listPaths.bucket),
          request<Folder[]>(listPaths.folder),
        ]);
        setRecords(buckets);
        setParents(folders);
      }

      if (activeEntity === "task") {
        const [tasks, buckets] = await Promise.all([
          request<Task[]>(listPaths.task),
          request<Bucket[]>(listPaths.bucket),
        ]);
        setRecords(tasks);
        setParents(buckets);
      }

      if (activeEntity === "subtask") {
        const [subtasks, tasks] = await Promise.all([
          request<Subtask[]>(listPaths.subtask),
          request<Task[]>(listPaths.task),
        ]);
        setRecords(subtasks);
        setParents(tasks);
      }
    } catch (loadError) {
      setRecords([]);
      setParents([]);
      setError(messageFrom(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [activeEntity, request]);

  // Effects run after React paints. This one refreshes API data whenever the
  // user switches resource tabs, rather than fetching all four lists at once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPanel updates state after beginning an external API request.
    void loadPanel();
  }, [loadPanel]);

  const detail = parentDetails[activeEntity];

  function createPath(): string {
    if (activeEntity === "folder") return "/api/folders";
    if (activeEntity === "bucket") return `/api/folders/${parentId}/buckets`;
    if (activeEntity === "task") return `/api/buckets/${parentId}/tasks`;
    return `/api/tasks/${parentId}/subtasks`;
  }

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!name.trim()) {
      setError("Please enter a name before creating the record.");
      return;
    }

    if (detail && !parentId) {
      setError(`Choose a ${detail.label.toLowerCase()} before creating this record.`);
      return;
    }

    setIsCreating(true);

    try {
      await request(createPath(), {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      setNotice(`${entityLabels[activeEntity].slice(0, -1)} created successfully.`);
      await loadPanel();
    } catch (createError) {
      setError(messageFrom(createError));
    } finally {
      setIsCreating(false);
    }
  }

  async function renameRecord(record: EntityRecord, nextName: string) {
    setError(null);
    setNotice(null);

    try {
      await request(`${listPaths[activeEntity]}/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName.trim() }),
      });
      setNotice("Record renamed successfully.");
      await loadPanel();
    } catch (renameError) {
      setError(messageFrom(renameError));
    }
  }

  async function deleteRecord(record: EntityRecord) {
    setError(null);
    setNotice(null);

    try {
      await request(`${listPaths[activeEntity]}/${record.id}`, { method: "DELETE" });
      setNotice("Record deleted successfully.");
      await loadPanel();
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    }
  }

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
        <Button disabled={isLoading} onClick={() => void loadPanel()} variant="secondary">
          {isLoading ? "Refreshing…" : "Refresh list"}
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
                onChange={(event) => setParentId(event.target.value)}
                value={parentId}
              >
                <option value="">Choose a {detail.label.toLowerCase()}</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {recordName(parent)} ({parent.id.slice(0, 6)}…)
                  </option>
                ))}
              </select>
            </label>
          )}

          <Button className="sm:self-end" disabled={isCreating} type="submit">
            {isCreating ? "Creating…" : "Create"}
          </Button>
        </form>

        {detail && parents.length === 0 && !isLoading && (
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
      {notice && (
        <p className="mt-6 rounded-xl border border-[#cfe4d7] bg-[#f1faf4] px-4 py-3 text-sm text-[#2b6e46] dark:border-[#3f644d] dark:bg-[#24382b] dark:text-[#9fd9af]" role="status">
          {notice}
        </p>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between border-b border-[#efebe7] pb-3 dark:border-[#383531]">
          <h2 className="text-lg font-bold">Current records</h2>
          <span className="text-sm text-[#8b8580] dark:text-[#aaa29b]">{records.length} total</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading records from the backend…</p>
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
