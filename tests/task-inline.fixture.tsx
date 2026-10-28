import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { useWorkspaceData } from "../src/hooks/useWorkspaceData";
import { TaskPage } from "../src/pages/TaskPage";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

// The fixture exports a mount function for the browser harness.
// eslint-disable-next-line react-refresh/only-export-components
function Layout() {
  const workspace = useWorkspaceData();
  return <><Link to="/home">Home</Link><Outlet context={workspace} /></>;
}

const router = createMemoryRouter([{ element: <Layout />, children: [
  { path: "/tasks/:taskId", element: <TaskPage /> },
  { path: "/home", element: <p>Home page</p> },
] }], { initialEntries: ["/tasks/task-1"] });

export function startFixture() {
  createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}><ToastProvider><RouterProvider router={router} /></ToastProvider></QueryClientProvider></StrictMode>);
}
