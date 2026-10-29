import type { Subtask, Task } from "../types/entities";

export function taskProgress(task: Pick<Task, "isDone">, subtasks: readonly Pick<Subtask, "isDone">[]): number {
  if (task.isDone) return 100;
  if (subtasks.length === 0) return 0;
  return subtasks.filter((subtask) => subtask.isDone).length / subtasks.length * 100;
}

export function bucketProgress(tasks: readonly Task[], subtasks: readonly Subtask[]): number {
  if (tasks.length === 0) return 0;
  return tasks.reduce((total, task) =>
    total + taskProgress(task, subtasks.filter((subtask) => subtask.taskId === task.id)), 0) / tasks.length;
}
