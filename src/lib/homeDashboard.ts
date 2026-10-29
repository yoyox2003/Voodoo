import type { Bucket, Subtask, Task } from "../types/entities";
import { bucketProgress } from "./completionProgress";
import { dueDateKey } from "./dueDates";

const importanceOrder: Record<Task["importance"], number> = { RED: 0, AMBER: 1, GREEN: 2 };

export function groupHomeTasks(tasks: readonly Task[], today: string) {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const lastDay = end.toISOString().slice(0, 10);
  const groups: { overdue: Task[]; today: Task[]; upcoming: Task[] } = { overdue: [], today: [], upcoming: [] };
  const ordered = tasks.filter((task) => !task.isDone && task.dueDate).slice().sort((a, b) =>
    (dueDateKey(a.dueDate) ?? "").localeCompare(dueDateKey(b.dueDate) ?? "") ||
    importanceOrder[a.importance] - importanceOrder[b.importance] ||
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  for (const task of ordered) {
    const day = dueDateKey(task.dueDate)!;
    if (day < today) groups.overdue.push(task);
    else if (day === today) groups.today.push(task);
    else if (day <= lastDay) groups.upcoming.push(task);
  }
  return groups;
}

export function rankHomeBuckets(buckets: readonly Bucket[], tasks: readonly Task[], subtasks: readonly Subtask[]) {
  return buckets.flatMap((bucket) => {
    const bucketTasks = tasks.filter((task) => task.bucketId === bucket.id);
    if (bucketTasks.length === 0) return [];
    const progress = bucketProgress(bucketTasks, subtasks);
    return progress < 100 ? [{ bucket, count: bucketTasks.length, progress }] : [];
  }).sort((a, b) => a.progress - b.progress || a.bucket.name.localeCompare(b.bucket.name) || a.bucket.id.localeCompare(b.bucket.id)).slice(0, 6);
}
