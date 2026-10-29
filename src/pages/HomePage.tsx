import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CompletionProgress } from "../components/CompletionProgress";
import { CompletionToggle } from "../components/CompletionToggle";
import { TaskImportance } from "../components/TaskImportance";
import { useLocalToday } from "../hooks/useLocalToday";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import type { WorkspaceData } from "../hooks/useWorkspaceData";
import { taskProgress } from "../lib/completionProgress";
import { dueDateKey, formatCalendarDay } from "../lib/dueDates";
import { groupHomeTasks, rankHomeBuckets } from "../lib/homeDashboard";
import type { Task } from "../types/entities";
import { Button } from "../UI/Button";
import { PageFrame, WorkspacePageStatus } from "./PageState";

function TaskSection({ title, tasks, workspace }: { title: string; tasks: Task[]; workspace: WorkspaceData }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <section aria-label={title}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">{title}<span className="text-sm font-normal text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span></h2>
      {tasks.length === 0 ? <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">No tasks in this section.</p> : (
        <ul className="mt-3 grid gap-2">
          {(showAll ? tasks : tasks.slice(0, 5)).map((task) => {
            const bucket = workspace.buckets.find((item) => item.id === task.bucketId);
            const folder = workspace.folders.find((item) => item.id === bucket?.folderId);
            const day = dueDateKey(task.dueDate)!;
            return <li key={task.id} className="flex min-w-0 items-start gap-2 rounded-md border border-[#e9e5e2] px-3 py-3 dark:border-[#393531]">
              <span className="-ml-1.5 -mt-1.5 shrink-0"><CompletionToggle kind="task" record={task} /></span>
              <Link viewTransition className="min-w-0 flex-1 hover:text-[#c84b37] focus-visible:outline-2 focus-visible:outline-[#d95d47] dark:hover:text-[#ffad9b]" to={`/tasks/${task.id}`}>
                <span className="flex min-w-0 items-center gap-2"><TaskImportance importance={task.importance} /><span className="min-w-0 break-words text-sm font-medium">{task.title}</span></span>
                <span className="mt-1 block break-words text-xs text-[#77716b] dark:text-[#aaa29b]">{[folder?.name, bucket?.name].filter(Boolean).join(" / ")} · {formatCalendarDay(day)}</span>
              </Link>
              <CompletionProgress label={`${task.title} progress`} value={taskProgress(task, workspace.subtasks.filter((subtask) => subtask.taskId === task.id))} />
            </li>;
          })}
        </ul>
      )}
      {tasks.length > 5 && <button aria-expanded={showAll} className="mt-3 rounded text-sm font-medium text-[#c84b37] hover:underline focus-visible:ring-2 focus-visible:ring-[#d95d47] dark:text-[#ffad9b]" onClick={() => setShowAll((current) => !current)} type="button">{showAll ? "Show less" : "Show more"}<span className="sr-only"> {title} tasks</span></button>}
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const workspace = useWorkspaceOutlet();
  const today = useLocalToday();

  if (workspace.isLoading || workspace.isError) return <PageFrame title="Home" wide><WorkspacePageStatus {...workspace} /></PageFrame>;

  const groups = groupHomeTasks(workspace.tasks, today);
  const buckets = rankHomeBuckets(workspace.buckets, workspace.tasks, workspace.subtasks);
  return (
    <PageFrame title="Home" wide>
      <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">{formatCalendarDay(today)}</p>
      <Button className="mt-6" onClick={() => navigate("/tasks/new", { state: { returnTo: "/" }, viewTransition: true })}>Create task</Button>
      {workspace.buckets.length === 0 && <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">Create a folder and bucket using the sidebar before creating tasks.</p>}
      <div className="mt-9 grid min-w-0 items-start gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-9">
          <TaskSection title="Overdue" tasks={groups.overdue} workspace={workspace} />
          <TaskSection title="Today" tasks={groups.today} workspace={workspace} />
          <TaskSection title="Next 7 Days" tasks={groups.upcoming} workspace={workspace} />
        </div>
        <section aria-label="Bucket progress" className="min-w-0">
          <h2 className="text-lg font-semibold">Bucket progress</h2>
          {buckets.length === 0 ? <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">No active buckets with progress to show.</p> : <ul className="mt-3 grid gap-2">
            {buckets.map(({ bucket, count, progress }) => {
              const folder = workspace.folders.find((item) => item.id === bucket.folderId);
              return <li key={bucket.id}>
                <Link viewTransition className="block min-w-0 rounded-md border border-[#e9e5e2] p-3 hover:text-[#c84b37] focus-visible:outline-2 focus-visible:outline-[#d95d47] dark:border-[#393531] dark:hover:text-[#ffad9b]" to={`/buckets/${bucket.id}`}>
                  <span className="block break-words text-sm font-semibold">{bucket.name}</span>
                  <span className="mt-1 block break-words text-xs text-[#77716b] dark:text-[#aaa29b]">{folder?.name}{folder ? " · " : ""}{count} {count === 1 ? "task" : "tasks"}</span>
                  <div className="mt-3"><CompletionProgress label={`${bucket.name} progress`} value={progress} /></div>
                </Link>
              </li>;
            })}
          </ul>}
        </section>
      </div>
    </PageFrame>
  );
}
