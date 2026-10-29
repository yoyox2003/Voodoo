import { useState } from "react";
import { Button } from "../UI/Button";
import { TextField } from "../UI/TextField";
import type { EntityRecord } from "../types/entities";
import { recordName } from "../types/entities";

type ApiRecordRowProps = {
  onDelete: (record: EntityRecord) => Promise<void>;
  onRename: (record: EntityRecord, name: string) => Promise<void>;
  record: EntityRecord;
};

export function ApiRecordRow({ onDelete, onRename, record }: ApiRecordRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(recordName(record));
  const [isSaving, setIsSaving] = useState(false);

  async function saveRename() {
    if (!name.trim()) return;

    setIsSaving(true);
    await onRename(record, name);
    setIsSaving(false);
    setIsEditing(false);
  }

  async function deleteRecord() {
    const shouldDelete = window.confirm(
      `Delete “${recordName(record)}”? Parent records must be empty before deletion.`,
    );

    if (shouldDelete) {
      await onDelete(record);
    }
  }

  return (
    <li className="flex flex-col gap-3 border-b border-[#efebe7] py-4 dark:border-[#383531] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <TextField
            aria-label="New record name"
            label="New name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        ) : (
          <p className="truncate font-medium text-[#35322f] dark:text-[#eee9e4]">
            {recordName(record)}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-[#9b948d] dark:text-[#968e87]">
          id: {record.id.slice(0, 8)}…
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        {isEditing ? (
          <>
            <Button disabled={isSaving} onClick={() => void saveRename()}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
            <Button onClick={() => setIsEditing(false)} variant="ghost">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setIsEditing(true)} variant="secondary">
              Rename
            </Button>
            <Button onClick={() => void deleteRecord()} variant="danger">
              Delete
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
