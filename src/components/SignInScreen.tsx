import { SignIn } from "@clerk/react";
import { useTheme } from "../hooks/useTheme";
import { ThemeToggle } from "./ThemeToggle";

// Clerk handles passwords, social providers, MFA, and session security. This
// component supplies the surrounding TooDoo page instead of rebuilding auth.
export function SignInScreen() {
  const { theme } = useTheme();

  return (
    <main className="relative min-h-screen bg-[#f8f6f3] px-5 py-20 text-[#292827] transition-colors dark:bg-[#1b1a18] dark:text-[#f3efea] sm:grid sm:place-items-center sm:py-10">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#e7e2dc] bg-white shadow-[0_20px_80px_rgba(66,52,39,0.12)] transition-colors dark:border-[#3d3935] dark:bg-[#262421] dark:shadow-[0_20px_80px_rgba(0,0,0,0.35)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[#d95d47] p-8 text-white sm:p-12">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl font-black">
            ✓
          </div>
          <p className="mt-12 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
            TooDoo API tester
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Test your backend with a calm, focused workspace.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/85">
            Sign in once, then create, edit, and delete the records in your Todo hierarchy.
          </p>
        </div>

        <div className="flex min-h-[530px] items-center justify-center bg-[#fffefd] p-6 transition-colors dark:bg-[#211f1d] sm:p-10">
          <div className="w-full max-w-sm">
            <p className="mb-2 text-sm font-semibold text-[#d95d47]">WELCOME BACK</p>
            <h2 className="mb-7 text-3xl font-bold">Sign in to TooDoo</h2>
            {/* Clerk renders its own card, so its color variables need the same
                theme value as our surrounding React page. */}
            <SignIn
              appearance={{
                variables:
                  theme === "dark"
                    ? {
                        colorBackground: "#262421",
                        colorForeground: "#f3efea",
                        colorInput: "#1b1a18",
                        colorInputForeground: "#f3efea",
                        colorMutedForeground: "#b9b1aa",
                        colorNeutral: "#f3efea",
                        colorPrimary: "#d95d47",
                      }
                    : {
                        colorBackground: "#ffffff",
                        colorForeground: "#292827",
                        colorMutedForeground: "#77716b",
                        colorNeutral: "#292827",
                        colorPrimary: "#d95d47",
                      },
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
