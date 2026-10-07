import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useParams } from "react-router";
import { TaskMarker } from "../components/TaskMarker";
import { TaskControls } from "../components/TaskControls";
import { TaskImportance } from "../components/TaskImportance";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import type { Subtask, Task } from "../types/entities";
import { PageFrame, WorkspacePageStatus } from "./PageState";

type TaskGroupProps = { subtasks: Subtask[]; task: Task };

function TaskGroup({ subtasks, task }: TaskGroupProps) {
  const [showAllSubtasks, setShowAllSubtasks] = useState(false);
  const visibleSubtasks = showAllSubtasks ? subtasks : subtasks.slice(0, 3);
  return <section className="border-b border-[#e9e5e2] dark:border-[#393531]">
    <div className="flex min-h-12 items-center gap-3 py-2.5 text-[15px] font-medium">
      <Link className="flex min-w-0 flex-1 items-center gap-3 hover:text-[#c84b37] dark:hover:text-[#ffad9b]" to={`/tasks/${task.id}`}><TaskMarker done={task.isDone} /><TaskImportance importance={task.importance} /><span className={`truncate ${task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}`}>{task.title}</span></Link>
      <TaskControls task={task} />
    </div>
    {subtasks.length > 0 && <div className="ml-9 border-l border-[#e9e5e2] pb-3 pl-4 dark:border-[#393531]">
      <ul className="grid gap-0.5">{visibleSubtasks.map((subtask) => <li className="py-1 text-sm text-[#716a64] dark:text-[#b9b1aa]" key={subtask.id}>□ {subtask.title}</li>)}</ul>
      {subtasks.length > 3 && <button className="mt-2 text-sm font-medium text-[#c84b37] hover:underline dark:text-[#ffad9b]" onClick={() => setShowAllSubtasks((current) => !current)} type="button">{showAllSubtasks ? "Show less" : "Show more"}</button>}
    </div>}
  </section>;
}

export function BucketPage() {
  const { bucketId } = useParams();
  const workspace = useWorkspaceOutlet();
  const bucket = workspace.buckets.find((item) => item.id === bucketId);
  if (workspace.isLoading || workspace.isError) return <PageFrame title="Bucket"><WorkspacePageStatus {...workspace} /></PageFrame>;
  if (!bucket) return <PageFrame title="Bucket not found"><p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">This bucket is unavailable.</p></PageFrame>;

  const tasks = workspace.tasks.filter((task) => task.bucketId === bucket.id);
  return <PageFrame eyebrow="Bucket" title={bucket.name}>
    {bucket.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]">{bucket.description}</p>}
    {tasks.length === 0 ? <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">This bucket has no tasks yet.</p>
      : <section className="mt-10"><div className="flex h-9 items-center gap-2 border-b border-[#e9e5e2] text-[15px] font-semibold dark:border-[#393531]"><ChevronDown aria-hidden="true" size={16} /> Tasks <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span></div><div>{tasks.map((task) => <TaskGroup key={task.id} subtasks={workspace.subtasks.filter((subtask) => subtask.taskId === task.id)} task={task} />)}</div></section>}
  </PageFrame>;
}
