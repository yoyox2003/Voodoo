import { UserButton, useUser } from "@clerk/react";
import { CalendarDays, ChevronDown, ChevronRight, Folder, FolderPlus, Home, Menu, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { useWorkspaceData } from "../hooks/useWorkspaceData";
import type { Folder as FolderEntity } from "../types/entities";
import { CreateWorkspaceItemDialog } from "./CreateWorkspaceItemDialog";
import { ThemeToggle } from "./ThemeToggle";

type CreateTarget = { kind: "folder" } | { folder: FolderEntity; kind: "bucket" };

function pathId(pathname: string, resource: "folders" | "buckets" | "tasks") {
  const parts = pathname.split("/");
  return parts[1] === resource ? parts[2] : undefined;
}

function itemClass(isActive: boolean) {
  return `flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm transition ${
    isActive
      ? "bg-[#fff0e9] font-medium text-[#c84b37] dark:bg-[#442c27] dark:text-[#ffad9b]"
      : "text-[#4b4743] hover:bg-[#f3f1ef] dark:text-[#d1cbc5] dark:hover:bg-[#302d29]"
  }`;
}

export function WorkspaceLayout() {
  const workspace = useWorkspaceData();
  const { user } = useUser();
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeBucketId = pathId(pathname, "buckets") ?? workspace.tasks.find((task) => task.id === pathId(pathname, "tasks"))?.bucketId;
  const activeFolderId = pathId(pathname, "folders") ?? workspace.buckets.find((bucket) => bucket.id === activeBucketId)?.folderId;
  const bucketsByFolder = new Map<string, typeof workspace.buckets>();

  workspace.buckets.forEach((bucket) => {
    const items = bucketsByFolder.get(bucket.folderId) ?? [];
    items.push(bucket);
    bucketsByFolder.set(bucket.folderId, items);
  });

  useEffect(() => {
    if (!isSidebarOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSidebarOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSidebarOpen]);

  function toggleFolder(folderId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#fffdfc] text-[#282522] dark:bg-[#1e1c1a] dark:text-[#f3efea] lg:flex">
      {isSidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#282522]/35 lg:hidden" onClick={closeSidebar} type="button" />}
      <aside
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[#e9e5e2] bg-[#faf9f8] px-3 py-4 shadow-xl transition-transform duration-200 dark:border-[#37332f] dark:bg-[#252220] lg:static lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        id="workspace-sidebar"
      >
        <div className="flex items-center justify-between px-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserButton appearance={{ variables: theme === "dark" ? { colorBackground: "#262421", colorForeground: "#f3efea", colorMutedForeground: "#b9b1aa", colorNeutral: "#f3efea", colorPrimary: "#d95d47" } : undefined }} />
            <p className="truncate text-sm font-semibold">{user?.firstName ?? "My workspace"}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle compact />
            <button aria-label="Close navigation" className="rounded-md p-2 text-[#6f6963] hover:bg-[#eeeae7] dark:text-[#bcb4ad] dark:hover:bg-[#302d29] lg:hidden" onClick={closeSidebar} type="button"><X aria-hidden="true" size={18} /></button>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="mt-6 grid gap-1">
          <NavLink className={({ isActive }) => itemClass(isActive)} end onClick={closeSidebar} to="/"><Home aria-hidden="true" size={17} /> Home</NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} onClick={closeSidebar} to="/calendar"><CalendarDays aria-hidden="true" size={17} /> Calendar</NavLink>
        </nav>

        <section className="mt-7 min-h-0 flex-1 overflow-y-auto" aria-labelledby="folders-heading">
          <div className="mb-2 flex items-center justify-between px-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#827a73] dark:text-[#aaa29b]" id="folders-heading">Folders</p>
            <button aria-label="Add folder" className="rounded p-1 text-[#77716b] hover:bg-[#eeeae7] hover:text-[#c84b37] dark:text-[#aaa29b] dark:hover:bg-[#302d29] dark:hover:text-[#ffad9b]" onClick={() => setCreateTarget({ kind: "folder" })} type="button"><Plus aria-hidden="true" size={16} /></button>
          </div>
          {workspace.isLoading ? <p className="px-2.5 py-2 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading folders…</p>
            : workspace.isError ? <p className="px-2.5 py-2 text-sm text-[#b74131] dark:text-[#ff9680]">Unable to load folders.</p>
            : workspace.folders.length === 0 ? <p className="px-2.5 py-2 text-sm text-[#77716b] dark:text-[#aaa29b]">No folders yet.</p>
            : <ul className="grid gap-0.5">
              {workspace.folders.map((folder) => {
                const isFolderActive = folder.id === activeFolderId;
                const isExpanded = expandedFolderIds.has(folder.id) || isFolderActive;
                const folderBuckets = bucketsByFolder.get(folder.id) ?? [];
                return (
                  <li key={folder.id}>
                    <div className={`group flex items-center rounded-md ${isFolderActive ? "bg-[#fff6f1] dark:bg-[#332724]" : ""}`}>
                      <button aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`} className="ml-1 rounded p-1 text-[#8a837c] hover:bg-[#eeeae7] dark:text-[#aaa29b] dark:hover:bg-[#302d29]" onClick={() => toggleFolder(folder.id)} type="button">
                        {isExpanded ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />}
                      </button>
                      <NavLink className={({ isActive }) => `${itemClass(isActive)} min-w-0 flex-1 px-1.5`} onClick={closeSidebar} to={`/folders/${folder.id}`}><Folder aria-hidden="true" size={16} /><span className="truncate">{folder.name}</span></NavLink>
                      <button aria-label={`Add a bucket to ${folder.name}`} className="mr-1 rounded p-1 text-[#8a837c] opacity-100 hover:bg-[#eeeae7] hover:text-[#c84b37] dark:text-[#aaa29b] dark:hover:bg-[#302d29] dark:hover:text-[#ffad9b] lg:opacity-0 lg:group-hover:opacity-100" onClick={() => setCreateTarget({ kind: "bucket", folder })} type="button"><Plus aria-hidden="true" size={15} /></button>
                    </div>
                    {isExpanded && <ul className="ml-5 grid gap-0.5 border-l border-[#e9e5e2] py-1 pl-2 dark:border-[#413c38]">
                      {folderBuckets.length === 0 ? <li className="px-2.5 py-1.5 text-xs text-[#8b8580] dark:text-[#aaa29b]">No buckets yet.</li>
                        : folderBuckets.map((bucket) => <li key={bucket.id}><NavLink className={({ isActive }) => itemClass(isActive)} onClick={closeSidebar} to={`/buckets/${bucket.id}`}><span aria-hidden="true" className="h-2 w-2 rounded-sm border border-current" /><span className="truncate">{bucket.name}</span></NavLink></li>)}
                    </ul>}
                  </li>
                );
              })}
            </ul>}
        </section>
        <button className="mt-4 flex min-h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-[#c84b37] transition hover:bg-[#fff0e9] dark:text-[#ffad9b] dark:hover:bg-[#442c27]" onClick={() => setCreateTarget({ kind: "folder" })} type="button"><FolderPlus aria-hidden="true" size={17} /> Add folder</button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-[#e9e5e2] bg-[#fffdfc] px-4 dark:border-[#37332f] dark:bg-[#1e1c1a] lg:hidden">
          <button aria-controls="workspace-sidebar" aria-expanded={isSidebarOpen} aria-label="Open navigation" className="rounded-md p-2 text-[#4b4743] hover:bg-[#f3f1ef] dark:text-[#d1cbc5] dark:hover:bg-[#302d29]" onClick={() => setIsSidebarOpen(true)} type="button"><Menu aria-hidden="true" size={20} /></button>
          <p className="text-sm font-semibold">Voodoo</p>
          <ThemeToggle compact />
        </header>
        <Outlet context={workspace} />
      </div>
      <CreateWorkspaceItemDialog key={createTarget ? `${createTarget.kind}-${createTarget.kind === "bucket" ? createTarget.folder.id : "new"}` : "closed"} onClose={() => setCreateTarget(null)} target={createTarget} />
    </div>
  );
}
