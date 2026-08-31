import { ClerkLoaded, ClerkLoading, Show } from "@clerk/react";
import { Route, Routes } from "react-router";
import { ApiTesterPage } from "./components/ApiTesterPage";
import { SignInScreen } from "./components/SignInScreen";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { BucketPage } from "./pages/BucketPage";
import { CalendarPage } from "./pages/CalendarPage";
import { FolderPage } from "./pages/FolderPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TaskPage } from "./pages/TaskPage";

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
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="folders/:folderId" element={<FolderPage />} />
              <Route path="buckets/:bucketId" element={<BucketPage />} />
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
