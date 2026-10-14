// Browser smoke-test entrypoint only; this file is not part of the app build.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router";
import { useWorkspaceData } from "../src/hooks/useWorkspaceData";
import { CalendarPage } from "../src/pages/CalendarPage";
import { TaskPage } from "../src/pages/TaskPage";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

export function Layout() {
  const workspace = useWorkspaceData();
  return <><Link to="/calendar">Back to calendar</Link><Outlet context={workspace} /></>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/calendar"]}>
          <Routes><Route element={<Layout />}><Route path="calendar" element={<CalendarPage />} /><Route path="tasks/:taskId" element={<TaskPage />} /></Route></Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
