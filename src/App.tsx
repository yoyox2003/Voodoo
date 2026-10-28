import { ClerkLoaded, ClerkLoading, Show } from "@clerk/react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { lazy, Suspense } from "react";
import { ApiTesterPage } from "./components/ApiTesterPage";
import { SignInScreen } from "./components/SignInScreen";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { BucketPage } from "./pages/BucketPage";
import { FolderPage } from "./pages/FolderPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TaskPage } from "./pages/TaskPage";
import { TaskCreatePage } from "./pages/TaskCreatePage";

function LegacyTaskEdit() {
  const { taskId } = useParams();
  return <Navigate to={`/tasks/${taskId}`} replace state={{ startEditing: true }} />;
}

// Load the calendar library only when visiting its page.
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));

function App() {
  return (
    <>
      {/* ClerkLoading prevents a brief flash of the sign-in screen while Clerk
          checks whether the browser already has a valid session. */}
      <ClerkLoading>
        <main className="grid min-h-screen place-items-center bg-[#f8f6f3] text-sm text-[#77716b]">
          Loading your Voodoo session…
        </main>
      </ClerkLoading>

      <ClerkLoaded>
        {/* Show keeps the authentication decision close to the app entry point.
            The tester component cannot render until Clerk says the user is in. */}
        <Show when="signed-out">
          <SignInScreen />
        </Show>
        <Show when="signed-in">
          <Routes>
            <Route element={<WorkspaceLayout />}>
              <Route index element={<HomePage />} />
              <Route path="calendar" element={<Suspense fallback={<p className="p-8 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading calendar…</p>}><CalendarPage /></Suspense>} />
              <Route path="folders/:folderId" element={<FolderPage />} />
              <Route path="buckets/:bucketId" element={<BucketPage />} />
              <Route path="tasks/new" element={<TaskCreatePage />} />
              <Route path="tasks/:taskId/edit" element={<LegacyTaskEdit />} />
              <Route path="tasks/:taskId" element={<TaskPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="api-tester" element={<ApiTesterPage />} />
          </Routes>
        </Show>
      </ClerkLoaded>
    </>
  );
}

export default App;
