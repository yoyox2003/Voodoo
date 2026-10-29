import { useLocation, useNavigate, useSearchParams } from "react-router";
import { TaskDetail } from "../components/TaskDetail";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import type { Task } from "../types/entities";
import { Button } from "../UI/Button";
import { PageFrame, WorkspacePageStatus } from "./PageState";

function returnPath(state: unknown): string {
  if (typeof state === "object" && state !== null && "returnTo" in state) {
    const value = state.returnTo;
    if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  }
  return "/";
}

function validDay(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function TaskCreatePage() {
  const workspace = useWorkspaceOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = returnPath(location.state);

  if (workspace.isLoading || workspace.isError) {
    return (
      <PageFrame title="Create task">
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  }

  if (workspace.buckets.length === 0) {
    return (
      <PageFrame backTo={backTo} title="Create task">
        <section className="mt-8 rounded-xl border border-[#efd5c7] bg-[#fff7f2] p-5 text-sm text-[#8c4435] dark:border-[#653f37] dark:bg-[#362522] dark:text-[#ffad9b]">
          <h2 className="font-semibold">Create a bucket first</h2>
          <p className="mt-2 leading-6">
            Tasks live inside buckets. Use the plus buttons in the sidebar to create a folder, then
            a bucket, before returning here.
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate(backTo, { viewTransition: true })}
            variant="secondary"
          >
            Go back
          </Button>
        </section>
      </PageFrame>
    );
  }

  const requestedBucketId = searchParams.get("bucketId") ?? "";
  const task: Task = {
    id: "",
    title: "",
    description: null,
    dueDate: validDay(searchParams.get("dueDate")),
    importance: "GREEN",
    isDone: false,
    position: 0,
    bucketId: workspace.buckets.some((bucket) => bucket.id === requestedBucketId)
      ? requestedBucketId
      : "",
    createdAt: "",
  };

  return (
    <TaskDetail
      task={task}
      subtasks={[]}
      creation={{
        buckets: workspace.buckets,
        folders: workspace.folders,
        returnTo: backTo,
        bucketFromPage: Boolean(task.bucketId),
      }}
    />
  );
}
