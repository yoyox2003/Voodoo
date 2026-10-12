import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../UI/Button";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { ApiError } from "../lib/api";
import { useToast } from "../toast/useToast";
import type { Bucket, Folder } from "../types/entities";

type CreateTarget = { kind: "folder" } | { folder: Folder; kind: "bucket" };

type CreateWorkspaceItemDialogProps = {
  onClose: () => void;
  target: CreateTarget | null;
};

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something unexpected went wrong.";
}

export function CreateWorkspaceItemDialog({ onClose, target }: CreateWorkspaceItemDialogProps) {
  const request = useAuthenticatedApi();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const itemLabel = target?.kind === "bucket" ? "bucket" : "folder";

  useEffect(() => {
    if (target) {
      inputRef.current?.focus();
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, target]);

  const createMutation = useMutation({
    mutationFn: (nextName: string) => {
      if (!target) throw new Error("Choose what to create before submitting the form.");

      const path =
        target.kind === "folder"
          ? "/api/folders"
          : `/api/folders/${target.folder.id}/buckets`;
      return request<Folder | Bucket>(path, {
        method: "POST",
        body: JSON.stringify({ name: nextName }),
      });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["api", userId] });
      toast.success(`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} created successfully.`);
      onClose();
      navigate("folderId" in created ? `/buckets/${created.id}` : `/folders/${created.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!target) return null;

  const error = validationError;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError(`Enter a ${itemLabel} name.`);
      return;
    }

    setValidationError(null);
    createMutation.mutate(trimmedName);
  }

  return (
    <div
      aria-labelledby="create-workspace-item-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#282522]/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !createMutation.isPending) onClose();
      }}
      role="dialog"
    >
      <form className="w-full max-w-md rounded-xl border border-[#e9e5e2] bg-[#fffdfc] p-6 shadow-2xl dark:border-[#413c38] dark:bg-[#252220]" onSubmit={submit}>
        <h2 className="text-lg font-semibold" id="create-workspace-item-title">
          Add {itemLabel}
        </h2>
        {target.kind === "bucket" && (
          <p className="mt-1 text-sm text-[#77716b] dark:text-[#aaa29b]">Inside {target.folder.name}</p>
        )}
        <label className="mt-6 grid gap-2 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]" htmlFor="workspace-item-name">
          {itemLabel === "folder" ? "Folder" : "Bucket"} name
          <input
            className="rounded-md border border-[#d9d4cf] bg-white px-3 py-2.5 text-[#292827] outline-none placeholder:text-[#a6a19b] focus:border-[#c84b37] focus:ring-2 focus:ring-[#c84b37]/15 dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea]"
            id="workspace-item-name"
            onChange={(event) => setName(event.target.value)}
            placeholder={`New ${itemLabel}…`}
            ref={inputRef}
            value={name}
          />
        </label>
        {error && <p className="mt-3 text-sm text-[#b74131] dark:text-[#ff9680]" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={createMutation.isPending} onClick={onClose} variant="ghost">Cancel</Button>
          <Button disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Adding…" : `Add ${itemLabel}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
