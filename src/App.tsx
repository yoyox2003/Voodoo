import { ClerkLoaded, ClerkLoading, Show } from "@clerk/react";
import { Outlet } from "react-router";
import { SignInScreen } from "./components/SignInScreen";

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
          <Outlet />
        </Show>
      </ClerkLoaded>
    </>
  );
}

export default App;
