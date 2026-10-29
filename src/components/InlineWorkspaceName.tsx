import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import type { Bucket, Folder } from "../types/entities";

export function InlineWorkspaceName({
  item,
  kind,
}: {
  item: Folder | Bucket;
  kind: "folder" | "bucket";
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const saving = useRef(false);
  const cancelBlur = useRef(false);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const path = kind === "folder" ? "/api/folders" : "/api/buckets";
  const queryKey = apiQueryKey(userId, path);

  const rename = useMutation({
    mutationFn: (nextName: string) =>
      request<Folder | Bucket>(`${path}/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName }),
      }),
    onSuccess: (updated) => {
      // The sidebar and pages use the same query, so they see the saved name.
      queryClient.setQueryData<(Folder | Bucket)[]>(queryKey, (current = []) =>
        current.map((record) => (record.id === updated.id ? updated : record)),
      );
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : `Unable to rename ${kind}.`),
    onSettled: () => {
      saving.current = false;
    },
  });

  function save() {
    if (cancelBlur.current || saving.current) return;
    const nextName = name.trim();
    if (!nextName) {
      toast.error(`Enter a ${kind} name.`);
      return;
    }
    if (nextName === item.name) {
      setEditing(false);
      return;
    }
    // Enter and blur can happen together, so avoid sending the same rename twice.
    saving.current = true;
    rename.mutate(nextName);
  }

  return editing ? (
    <span className="relative inline-grid min-w-0 max-w-full break-words">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {name || " "}
      </span>
      <input
        aria-label={`${kind === "folder" ? "Folder" : "Bucket"} name`}
        autoFocus
        className="inline-name-enter absolute -inset-x-2 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+1rem)] rounded-sm border-0 bg-[#fff6f1] px-2 py-1 font-[inherit] text-inherit outline-none disabled:opacity-60 dark:bg-[#332724]"
        disabled={rename.isPending}
        onBlur={save}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelBlur.current = true;
            setEditing(false);
          }
        }}
        value={name}
      />
    </span>
  ) : (
    <button
      aria-label={`Rename ${kind} ${item.name}`}
      className="-mx-2 -my-1 rounded-sm px-2 py-1 text-left font-inherit transition-colors hover:text-[#c84b37] focus:outline-none dark:hover:text-[#ffad9b]"
      onClick={() => {
        cancelBlur.current = false;
        setName(item.name);
        setEditing(true);
      }}
      title={`Click to rename ${kind}`}
      type="button"
    >
      {item.name}
    </button>
  );
}
