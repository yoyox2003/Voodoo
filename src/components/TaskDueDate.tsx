import { dueDateKey, formatCalendarDay } from "../lib/dueDates";
import type { Task } from "../types/entities";

export function TaskDueDate({ task }: { task: Task }) {
  const dueDay = dueDateKey(task.dueDate);

  // Dates are selected when a task is created. This page deliberately only
  // reads the saved value, so viewing a task cannot change its schedule.
  return (
    <section className="mt-8 border-t border-[#e9e5e2] pt-5 dark:border-[#393531]">
      <h2 className="text-sm font-semibold">Due date</h2>
      <p className="mt-3 text-sm text-[#716a64] dark:text-[#b9b1aa]">
        {dueDay ? formatCalendarDay(dueDay) : "No due date set."}
      </p>
    </section>
  );
}
