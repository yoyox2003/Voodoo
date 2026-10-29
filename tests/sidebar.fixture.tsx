import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { WorkspaceLayout } from "../src/components/WorkspaceLayout";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

const router = createMemoryRouter([{ element: <WorkspaceLayout />, children: [
  { index: true, element: <h1>Home page</h1> },
  { path: "/calendar", element: <h1>Calendar page</h1> },
  { path: "/folders/:folderId", element: <h1>Folder page</h1> },
  { path: "/buckets/:bucketId", element: <><h1>Bucket page</h1><Link to="/tasks/task-1">Open task</Link></> },
  { path: "/tasks/:taskId", element: <h1>Task page</h1> },
] }], { initialEntries: ["/"] });

export function startFixture() {
  createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}><ThemeProvider><ToastProvider><RouterProvider router={router} /></ToastProvider></ThemeProvider></QueryClientProvider></StrictMode>);
}
