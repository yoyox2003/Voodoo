import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { BucketDrop, WorkspaceDrag } from "../src/components/WorkspaceDrag";
import { useWorkspaceData } from "../src/hooks/useWorkspaceData";
import { BucketPage } from "../src/pages/BucketPage";
import { FolderPage } from "../src/pages/FolderPage";
import { TaskPage } from "../src/pages/TaskPage";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

// This fixture exports a mount function for the browser test.
// eslint-disable-next-line react-refresh/only-export-components
function Layout() {
  const workspace = useWorkspaceData();
  return <WorkspaceDrag workspace={workspace}><div className="flex gap-8"><aside className="w-48 shrink-0">
    {workspace.buckets.map((bucket) => <BucketDrop key={bucket.id} bucketId={bucket.id} sidebar><Link to={`/buckets/${bucket.id}`}>Sidebar {bucket.name}</Link></BucketDrop>)}
    <Link to="/folders/folder-1">Folder</Link>
  </aside><div className="flex-1"><Outlet context={workspace} /></div></div></WorkspaceDrag>;
}

const router = createMemoryRouter([{ element: <Layout />, children: [
  { path: "/folders/:folderId", element: <FolderPage /> },
  { path: "/buckets/:bucketId", element: <BucketPage /> },
  { path: "/tasks/:taskId", element: <TaskPage /> },
] }], { initialEntries: ["/folders/folder-1"] });

export function startFixture() {
  createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><RouterProvider router={router} /></ToastProvider></QueryClientProvider></StrictMode>);
}
