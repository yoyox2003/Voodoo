import { useAuth } from "@clerk/react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import type { Subtask, Task } from "../types/entities";
import { TaskMarker } from "./TaskMarker";

type CompletionToggleProps = {
  kind: "task" | "subtask";
  record: Task | Subtask;
};

export function CompletionToggle({ kind, record }: CompletionToggleProps) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const path = kind === "task" ? "/api/tasks" : "/api/subtasks";
  const queryKey = apiQueryKey(userId, path);
  const mutationKey = [...queryKey, record.id, "update"];
  // The same record may appear in several views. Disable its controls while
  // any of them is saving, so another click cannot send a competing update.
  const isSaving = useIsMutating({ mutationKey }) > 0;

  const toggle = useMutation({
    mutationKey,
    mutationFn: (isDone: boolean) => request<Task | Subtask>(`${path}/${record.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDone }),
    }),
    onMutate: async (isDone) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<(Task | Subtask)[]>(queryKey)
        ?.find((item) => item.id === record.id);
      // All views share this list, so the checkmark changes immediately while
      // the authenticated request saves the actual row in the database.
      queryClient.setQueryData<(Task | Subtask)[]>(queryKey, (current = []) =>
        current.map((item) => item.id === record.id ? { ...item, isDone } : item),
      );
      return { previous };
    },
    onSuccess: (savedRecord) => {
      queryClient.setQueryData<(Task | Subtask)[]>(queryKey, (current = []) =>
        current.map((item) => item.id === savedRecord.id ? savedRecord : item),
      );
    },
    onError: (error, _isDone, context) => {
      // Roll back only this record; another task may have saved successfully
      // during this request, and its changes must not be undone.
      if (context?.previous) {
        const previous = context.previous;
        queryClient.setQueryData<(Task | Subtask)[]>(queryKey, (current = []) =>
          current.map((item) => item.id === record.id ? previous : item),
        );
      }
      toast.error(error instanceof Error ? error.message : `Unable to update ${kind}.`);
    },
    onSettled: () => {
      // Wait for other updates on this list before refreshing; a refresh in
      // the middle of them could overwrite their optimistic checkmarks.
      if (queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const label = `Mark ${kind} "${record.title}" as ${record.isDone ? "incomplete" : "complete"}`;
  return (
    <button
      aria-label={label}
      aria-pressed={record.isDone}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full outline-none transition hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#302d29]"
      disabled={isSaving || toggle.isPending}
      onClick={() => {
        // Explicit false reopens a completed item; omission would preserve it.
        if (!isSaving && !toggle.isPending) toggle.mutate(!record.isDone);
      }}
      title={label}
      type="button"
    >
      <TaskMarker done={record.isDone} />
    </button>
  );
}
