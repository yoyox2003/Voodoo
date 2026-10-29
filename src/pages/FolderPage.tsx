import { useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { Link, useParams } from "react-router";
import { CompletionToggle } from "../components/CompletionToggle";
import { InlineWorkspaceName } from "../components/InlineWorkspaceName";
import { TaskImportance } from "../components/TaskImportance";
import { BucketDrop, SortableTask, TaskListOrder } from "../components/WorkspaceDrag";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { PageFrame, WorkspacePageStatus } from "./PageState";

export function FolderPage() {
  const { folderId } = useParams();
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(() => new Set());
  const workspace = useWorkspaceOutlet();
  const folder = workspace.folders.find((item) => item.id === folderId);
  if (workspace.isLoading || workspace.isError)
    return (
      <PageFrame title="Folder">
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  if (!folder)
    return (
      <PageFrame title="Folder not found">
        <p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">
          This folder is unavailable.
        </p>
      </PageFrame>
    );

  const buckets = workspace.buckets.filter((bucket) => bucket.folderId === folder.id);
  return (
    <PageFrame
      eyebrow="Folder"
      title={<InlineWorkspaceName key={folder.id} item={folder} kind="folder" />}
    >
      {buckets.length === 0 ? (
        <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">
          This folder has no buckets yet.
        </p>
      ) : (
        <div className="mt-10 grid gap-11">
          {buckets.map((bucket) => {
            const tasks = workspace.tasks.filter((task) => task.bucketId === bucket.id);
            const isExpanded = !collapsedBuckets.has(bucket.id);
            return (
              <section key={bucket.id}>
                <div className="flex h-9 items-center justify-between border-b border-[#e9e5e2] dark:border-[#393531]">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      aria-controls={`folder-bucket-tasks-${bucket.id}`}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${bucket.name}`}
                      className="rounded text-[#8a837c] hover:text-[#c84b37] focus-visible:ring-2 focus-visible:ring-[#d95d47] dark:text-[#aaa29b] dark:hover:text-[#ffad9b]"
                      onClick={() =>
                        setCollapsedBuckets((current) => {
                          const next = new Set(current);
                          if (next.has(bucket.id)) next.delete(bucket.id);
                          else next.add(bucket.id);
                          return next;
                        })
                      }
                      type="button"
                    >
                      {isExpanded ? (
                        <ChevronDown aria-hidden="true" size={16} />
                      ) : (
                        <ChevronRight aria-hidden="true" size={16} />
                      )}
                    </button>
                    <Link
                      viewTransition
                      className="flex min-w-0 items-center gap-2 text-[15px] font-semibold hover:text-[#c84b37] dark:hover:text-[#ffad9b]"
                      to={`/buckets/${bucket.id}`}
                    >
                      <span className="truncate">{bucket.name}</span>
                      <span className="font-normal text-[#958d86] dark:text-[#aaa29b]">
                        {tasks.length}
                      </span>
                    </Link>
                  </div>
                  <Link
                    viewTransition
                    aria-label={`Open ${bucket.name}`}
                    className="rounded p-1 text-[#8a837c] hover:bg-[#f3f1ef] dark:text-[#aaa29b] dark:hover:bg-[#302d29]"
                    to={`/buckets/${bucket.id}`}
                  >
                    <MoreHorizontal aria-hidden="true" size={18} />
                  </Link>
                </div>
                <div
                  aria-hidden={!isExpanded}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  id={`folder-bucket-tasks-${bucket.id}`}
                  inert={!isExpanded}
                >
                  <div className="min-h-0 overflow-hidden">
                    <BucketDrop bucketId={bucket.id}>
                      <TaskListOrder tasks={tasks}>
                        {tasks.length === 0 ? (
                          <p className="px-9 py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">
                            No tasks yet.
                          </p>
                        ) : (
                          <ul>
                            {tasks.map((task) => (
                              <li key={task.id}>
                                <SortableTask task={task}>
                                  <div className="flex min-h-12 items-center gap-3 border-b border-[#efebe8] py-2.5 dark:border-[#312e2b]">
                                    <CompletionToggle kind="task" record={task} />
                                    <Link
                                      viewTransition
                                      className="flex min-w-0 flex-1 items-center gap-3 text-[15px] hover:text-[#c84b37] dark:hover:text-[#ffad9b]"
                                      to={`/tasks/${task.id}`}
                                    >
                                      <TaskImportance importance={task.importance} />
                                      <span
                                        className={
                                          task.isDone
                                            ? "text-[#958d86] line-through dark:text-[#aaa29b]"
                                            : ""
                                        }
                                      >
                                        {task.title}
                                      </span>
                                    </Link>
                                  </div>
                                </SortableTask>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TaskListOrder>
                    </BucketDrop>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
