import { ClerkProvider } from "@clerk/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App.tsx";
import "./index.css";
import { queryClient } from "./lib/queryClient.ts";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";
import { ToastProvider } from "./toast/ToastProvider.tsx";

// Vite only exposes variables that start with VITE_. A publishable key is safe
// for the browser; the Clerk secret key must stay in backend/.env only.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Copy .env.example to .env.local and add your Clerk publishable key.",
  );
}

const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ClerkProvider makes sign-in state and hooks such as useAuth available to
        every component below it. */}
    <ClerkProvider publishableKey={publishableKey}>
      <ThemeProvider>
        <ToastProvider>
          {/* QueryClientProvider gives API components one shared TanStack Query
              cache, so lists and parent dropdowns can reuse server data. */}
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>,
)
