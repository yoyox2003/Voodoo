import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Link, useParams } from "react-router";
import { TaskMarker } from "../components/TaskMarker";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { PageFrame, WorkspacePageStatus } from "./PageState";

export function FolderPage() {
  const { folderId } = useParams();
  const workspace = useWorkspaceOutlet();
  const folder = workspace.folders.find((item) => item.id === folderId);
  if (workspace.isLoading || workspace.isError) return <PageFrame title="Folder"><WorkspacePageStatus {...workspace} /></PageFrame>;
  if (!folder) return <PageFrame title="Folder not found"><p className="mt-5 text-sm text-[#77716b] dark:text-[#aaa29b]">This folder is unavailable.</p></PageFrame>;

  const buckets = workspace.buckets.filter((bucket) => bucket.folderId === folder.id);
  return <PageFrame title={folder.name}>
    {buckets.length === 0 ? <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">This folder has no buckets yet.</p>
      : <div className="mt-10 grid gap-11">
        {buckets.map((bucket) => {
          const tasks = workspace.tasks.filter((task) => task.bucketId === bucket.id);
          return <section key={bucket.id}>
            <div className="flex h-9 items-center justify-between border-b border-[#e9e5e2] dark:border-[#393531]">
              <Link className="flex items-center gap-2 text-[15px] font-semibold hover:text-[#c84b37] dark:hover:text-[#ffad9b]" to={`/buckets/${bucket.id}`}><ChevronDown aria-hidden="true" size={16} /><span>{bucket.name}</span><span className="font-normal text-[#958d86] dark:text-[#aaa29b]">{tasks.length}</span></Link>
              <Link aria-label={`Open ${bucket.name}`} className="rounded p-1 text-[#8a837c] hover:bg-[#f3f1ef] dark:text-[#aaa29b] dark:hover:bg-[#302d29]" to={`/buckets/${bucket.id}`}><MoreHorizontal aria-hidden="true" size={18} /></Link>
            </div>
            {tasks.length === 0 ? <p className="px-9 py-4 text-sm text-[#77716b] dark:text-[#aaa29b]">No tasks yet.</p>
              : <ul>{tasks.slice(0, 3).map((task) => <li className="border-b border-[#efebe8] dark:border-[#312e2b]" key={task.id}><Link className="flex min-h-12 items-center gap-3 py-2.5 text-[15px] hover:text-[#c84b37] dark:hover:text-[#ffad9b]" to={`/tasks/${task.id}`}><TaskMarker done={task.isDone} /><span>{task.title}</span></Link></li>)}{tasks.length > 3 && <li className="flex min-h-11 items-center gap-3 border-b border-[#efebe8] py-2.5 text-sm text-[#8a837c] dark:border-[#312e2b] dark:text-[#aaa29b]"><MoreHorizontal aria-hidden="true" size={21} /><span>{tasks.length - 3} more tasks</span></li>}</ul>}
          </section>;
        })}
      </div>}
  </PageFrame>;
}
