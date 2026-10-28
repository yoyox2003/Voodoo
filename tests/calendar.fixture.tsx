// Browser smoke-test entrypoint only; this file is not part of the app build.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { useWorkspaceData } from "../src/hooks/useWorkspaceData";
import { CalendarPage } from "../src/pages/CalendarPage";
import { TaskPage } from "../src/pages/TaskPage";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

export function Layout() {
  const workspace = useWorkspaceData();
  return <><Link to="/calendar">Back to calendar</Link><Outlet context={workspace} /></>;
}

const router = createMemoryRouter([{ element: <Layout />, children: [
  { path: "/calendar", element: <CalendarPage /> },
  { path: "/tasks/:taskId", element: <TaskPage /> },
] }], { initialEntries: ["/calendar"] });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
