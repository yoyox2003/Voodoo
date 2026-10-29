import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router";
import { useWorkspaceData } from "../src/hooks/useWorkspaceData";
import { HomePage } from "../src/pages/HomePage";
import { ToastProvider } from "../src/toast/ToastProvider";
import "../src/index.css";

// The fixture exports a mount function for the browser harness.
// eslint-disable-next-line react-refresh/only-export-components
function Layout() {
  const workspace = useWorkspaceData();
  return <Outlet context={workspace} />;
}
// eslint-disable-next-line react-refresh/only-export-components
function CreatePage() {
  const location = useLocation();
  return <p>Create task return: {location.state?.returnTo}</p>;
}
const router = createMemoryRouter([{ element: <Layout />, children: [
  { path: "/", element: <HomePage /> },
  { path: "/tasks/new", element: <CreatePage /> },
  { path: "/tasks/:taskId", element: <p>Task detail</p> },
  { path: "/buckets/:bucketId", element: <p>Bucket detail</p> },
] }], { initialEntries: ["/"] });

export function startFixture() {
  createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}><ToastProvider><RouterProvider router={router} /></ToastProvider></QueryClientProvider></StrictMode>);
}
