import { useParams } from "react-router";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { PageFrame, WorkspacePageStatus } from "./PageState";
import { TaskDetail } from "../components/TaskDetail";

export function TaskPage() {
  const { taskId } = useParams();
  const workspace = useWorkspaceOutlet();
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (!task && (workspace.isLoading || workspace.isError))
    return (
      <PageFrame title="Task">
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  if (!task)
    return (
      <PageFrame title="Task not found">
        <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">This task is unavailable.</p>
      </PageFrame>
    );

  return <TaskDetail key={task.id} task={task} subtasks={workspace.subtasks.filter((subtask) => subtask.taskId === task.id)} />;
}
