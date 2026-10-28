import { CalendarDays } from "lucide-react";
import { dueDateKey, formatCalendarDay } from "../lib/dueDates";
import type { Task } from "../types/entities";

export function TaskDueDate({ task }: { task: Task }) {
  const dueDay = dueDateKey(task.dueDate);

  // Dates are selected when a task is created. This page deliberately only
  // reads the saved value, so viewing a task cannot change its schedule.
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-[#716a64] dark:text-[#b9b1aa]">
      <CalendarDays aria-hidden="true" size={16} />
      {dueDay ? `Due ${formatCalendarDay(dueDay)}` : "No due date set"}
    </p>
  );
}
