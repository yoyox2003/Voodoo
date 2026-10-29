import { createBrowserRouter } from "react-router";
import App from "./App";
import { ApiTesterPage } from "./components/ApiTesterPage";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { BucketPage } from "./pages/BucketPage";
import { CalendarRoute } from "./pages/CalendarRoute";
import { FolderPage } from "./pages/FolderPage";
import { HomePage } from "./pages/HomePage";
import { LegacyTaskEdit } from "./pages/LegacyTaskEdit";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TaskCreatePage } from "./pages/TaskCreatePage";
import { TaskPage } from "./pages/TaskPage";

export const router = createBrowserRouter([{
  element: <App />,
  children: [
    {
      element: <WorkspaceLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "calendar", element: <CalendarRoute /> },
        { path: "folders/:folderId", element: <FolderPage /> },
        { path: "buckets/:bucketId", element: <BucketPage /> },
        { path: "tasks/new", element: <TaskCreatePage /> },
        { path: "tasks/:taskId/edit", element: <LegacyTaskEdit /> },
        { path: "tasks/:taskId", element: <TaskPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    { path: "api-tester", element: <ApiTesterPage /> },
  ],
}]);
