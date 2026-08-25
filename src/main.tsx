import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";

// Vite only exposes variables that start with VITE_. A publishable key is safe
// for the browser; the Clerk secret key must stay in backend/.env only.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Copy .env.example to .env.local and add your Clerk publishable key.",
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ClerkProvider makes sign-in state and hooks such as useAuth available to
        every component below it. */}
    <ClerkProvider publishableKey={publishableKey}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>,
)
