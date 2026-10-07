import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { useAuth } from "@clerk/react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";
import type { Task } from "../types/entities";

type TaskControlsProps = {
  task: Task;
};

type TaskUpdate = Pick<Task, "isDone" | "importance">;

const importanceValues: Task["importance"][] = ["GREEN", "AMBER", "RED"];

export function TaskControls({ task }: TaskControlsProps) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const tasksKey = apiQueryKey(userId, "/api/tasks");

  const updateTask = useMutation({
    mutationFn: (update: Partial<TaskUpdate>) =>
      request<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      }),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previousTasks = queryClient.getQueryData<Task[]>(tasksKey);

      // Update the shared list before the network request finishes, so the
      // task detail, bucket page, and folder preview all feel immediate.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((currentTask) =>
          currentTask.id === task.id ? { ...currentTask, ...update } : currentTask,
        ),
      );

      return { previousTasks };
    },
    onSuccess: (updatedTask) => {
      // Replace the optimistic copy with the database's authoritative task.
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) =>
        current.map((currentTask) => currentTask.id === task.id ? updatedTask : currentTask),
      );
    },
    onError: (_error, _update, context) => {
      // If PATCH fails, restore the snapshot so the UI never claims a change
      // that the backend did not save.
      queryClient.setQueryData(tasksKey, context?.previousTasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  });

  function toggleCompletion() {
    // Do not use a truthiness check here. Sending false explicitly is what
    // tells the backend to reopen a task that was previously completed.
    updateTask.mutate({ isDone: !task.isDone });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        aria-label={task.isDone ? "Mark task as incomplete" : "Mark task as complete"}
        aria-pressed={task.isDone}
        className="grid h-8 w-8 place-items-center rounded-full text-[#a49b94] outline-none transition hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#847b74] dark:hover:bg-[#302d29]"
        disabled={updateTask.isPending}
        onClick={toggleCompletion}
        title={task.isDone ? "Mark task as incomplete" : "Mark task as complete"}
        type="button"
      >
        {task.isDone
          ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#c84b37] text-white"><Check aria-hidden="true" size={13} strokeWidth={3} /></span>
          : <Circle aria-hidden="true" size={21} strokeWidth={1.5} />}
      </button>

      <div aria-label="Task importance" className="flex items-center gap-1" role="group">
        {importanceValues.map((importance) => {
          const label = importanceLabels[importance];
          const selected = task.importance === importance;
          return (
            <button
              aria-label={`Set importance to ${label}`}
              aria-pressed={selected}
              className={`grid h-7 w-7 place-items-center rounded-full outline-none transition hover:bg-[#f3f1ef] focus:ring-2 focus:ring-[#d95d47] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#302d29] ${selected ? "ring-2 ring-[#353535] ring-offset-2 dark:ring-[#eee9e4] dark:ring-offset-[#1b1a18]" : ""}`}
              disabled={updateTask.isPending}
              key={importance}
              onClick={() => updateTask.mutate({ importance })}
              title={`Set importance to ${label}`}
              type="button"
            >
              <span aria-hidden="true" className={`h-3 w-3 rounded-full ${importanceColorClasses[importance]}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
