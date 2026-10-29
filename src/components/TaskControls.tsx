import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import type { Task } from "../types/entities";
import { CompletionToggle } from "./CompletionToggle";
import { useToast } from "../toast/useToast";

type TaskControlsProps = {
  showCompletion?: boolean;
  /** Task detail keeps importance read-only; bucket rows may show its quick controls. */
  showImportance?: boolean;
  task: Task;
};

type TaskUpdate = Pick<Task, "importance">;

const importanceValues: Task["importance"][] = ["GREEN", "AMBER", "RED"];

export function TaskControls({
  task,
  showCompletion = true,
  showImportance = true,
}: TaskControlsProps) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const mutationKey = [...tasksKey, task.id, "update"];
  const isSaving = useIsMutating({ mutationKey }) > 0;
  const toast = useToast();

  const updateTask = useMutation({
    mutationKey,
    mutationFn: (update: Partial<TaskUpdate>) =>
      request<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      }),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previousTask = queryClient
        .getQueryData<Task[]>(tasksKey)
        ?.find((item) => item.id === task.id);

      // Update the shared list before the network request finishes, so the
      // task detail, bucket page, and folder preview all feel immediate.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((currentTask) =>
          currentTask.id === task.id ? { ...currentTask, ...update } : currentTask,
        ),
      );

      return { previousTask };
    },
    onSuccess: (updatedTask) => {
      // Replace the optimistic copy with the database's authoritative task.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((currentTask) => (currentTask.id === task.id ? updatedTask : currentTask)),
      );
    },
    onError: (error, _update, context) => {
      // If PATCH fails, restore the snapshot so the UI never claims a change
      // that the backend did not save.
      if (context?.previousTask) {
        const previousTask = context.previousTask;
        queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
          current.map((item) => (item.id === task.id ? previousTask : item)),
        );
      }
      toast.error(error instanceof Error ? error.message : "Unable to update importance.");
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: tasksKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: tasksKey });
      }
    },
  });

  return (
    <div className="flex items-center gap-1.5">
      {showCompletion && <CompletionToggle kind="task" record={task} />}

      {showImportance && (
        <div aria-label="Task importance" className="flex items-center gap-1" role="group">
          {importanceValues.map((importance) => {
            const label = importanceLabels[importance];
            const selected = task.importance === importance;
            return (
              <button
                aria-label={`Set importance to ${label}`}
                aria-pressed={selected}
                className="grid h-7 w-7 place-items-center rounded-full outline-none transition hover:bg-[#f3f1ef] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#302d29]"
                disabled={isSaving || updateTask.isPending}
                key={importance}
                onClick={() => updateTask.mutate({ importance })}
                title={`Set importance to ${label}`}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 rounded-full ${importanceColorClasses[importance]} ${selected ? "ring-1 ring-[#353535] ring-offset-1 dark:ring-[#eee9e4] dark:ring-offset-[#292724]" : ""}`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
