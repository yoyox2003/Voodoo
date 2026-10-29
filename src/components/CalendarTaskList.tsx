import { Link } from "react-router";
import type { WorkspaceData } from "../hooks/useWorkspaceData";
import { formatCalendarDay, tasksDueOn } from "../lib/dueDates";
import { CompletionToggle } from "./CompletionToggle";

type CalendarTaskListProps = {
  day: string;
  title: string;
  workspace: WorkspaceData;
};

export function CalendarTaskList({ day, title, workspace }: CalendarTaskListProps) {
  const tasks = tasksDueOn(workspace.tasks, day);
  const buckets = new Map(workspace.buckets.map((bucket) => [bucket.id, bucket]));
  const folders = new Map(workspace.folders.map((folder) => [folder.id, folder]));

  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span>
      </div>
      <p className="mt-1 text-xs text-[#77716b] dark:text-[#aaa29b]">{formatCalendarDay(day)}</p>
      {tasks.length === 0 ? <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">No tasks due on this day.</p> : (
        <ul className="mt-4 border-t border-[#e9e5e2] dark:border-[#393531]">
          {tasks.map((task) => {
            const bucket = buckets.get(task.bucketId);
            const folder = bucket ? folders.get(bucket.folderId) : undefined;
            return (
              <li className="flex items-start gap-1.5 border-b border-[#efebe8] py-3 dark:border-[#312e2b]" key={task.id}>
                <span className="-ml-1.5 -mt-1.5 shrink-0 rounded-full focus-within:ring-2 focus-within:ring-[#d95d47]">
                  <CompletionToggle kind="task" record={task} />
                </span>
                <Link viewTransition className="min-w-0 flex-1 hover:text-[#c84b37] focus-visible:outline-2 focus-visible:outline-[#d95d47] dark:hover:text-[#ffad9b]" to={`/tasks/${task.id}`}>
                  <span className="min-w-0">
                    <span className={`block break-words text-sm ${task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}>{task.title}</span>
                    <span className="mt-1 block text-xs text-[#77716b] dark:text-[#aaa29b]">{[folder?.name, bucket?.name].filter(Boolean).join(" / ")}{task.isDone ? " · Completed" : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
