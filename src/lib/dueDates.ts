import type { Task } from "../types/entities";

// Read the stored day instead of converting UTC midnight to local time.
export function dueDateKey(dueDate: string | null): string | null {
  return dueDate ? dueDate.slice(0, 10) : null;
}

export function localDateKey(date: Date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCalendarDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function tasksDueOn(tasks: Task[], day: string): Task[] {
  return tasks.filter((task) => dueDateKey(task.dueDate) === day);
}
