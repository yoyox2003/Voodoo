import { CheckSquare } from "lucide-react";
import { TaskControls } from "../components/TaskControls";
import { TaskImportance } from "../components/TaskImportance";
import { CompletionToggle } from "../components/CompletionToggle";
import { TaskDueDate } from "../components/TaskDueDate";
import { useParams } from "react-router";
import { useNavigate } from "react-router";
import { Button } from "../UI/Button";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { PageFrame, WorkspacePageStatus } from "./PageState";

export function TaskPage() {
  const { taskId } = useParams();
  const workspace = useWorkspaceOutlet();
  const navigate = useNavigate();
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (workspace.isLoading || workspace.isError)
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

  const subtasks = workspace.subtasks.filter((subtask) => subtask.taskId === task.id);
  return (
    <PageFrame
      eyebrow="Task"
      title={
        <span className={task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}>
          {task.title}
        </span>
      }
    >
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <TaskControls showImportance={false} task={task} />
        <TaskImportance importance={task.importance} />
        <span
          className={`text-sm ${task.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : "text-[#716a64] dark:text-[#b9b1aa]"}`}
        >
          {task.isDone ? "Completed" : "Open"}
        </span>
        <Button onClick={() => navigate(`/tasks/${task.id}/edit`)} variant="secondary">Edit task</Button>
      </div>
      <TaskDueDate key={task.id} task={task} />
      <section className="mt-10 border-y border-[#e9e5e2] py-5 dark:border-[#393531]">
        <h2 className="text-sm font-semibold">Description</h2>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]">
          {task.description ?? "No description yet."}
        </p>
      </section>
      <section className="mt-11">
        <div className="flex h-9 items-center gap-2 border-b border-[#e9e5e2] text-[15px] font-semibold dark:border-[#393531]">
          <CheckSquare aria-hidden="true" size={17} /> Subtasks{" "}
          <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{subtasks.length}</span>
        </div>
        {subtasks.length === 0 ? (
          <p className="py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">No subtasks yet.</p>
        ) : (
          <ul>
            {subtasks.map((subtask) => (
              <li
                className="flex min-h-12 items-center gap-3 border-b border-[#efebe8] py-2.5 text-[15px] dark:border-[#312e2b]"
                key={subtask.id}
              >
                <CompletionToggle kind="subtask" record={subtask} />
                <span className={subtask.isDone ? "text-[#958d86] line-through dark:text-[#aaa29b]" : ""}>{subtask.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageFrame>
  );
}
