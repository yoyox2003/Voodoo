import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dedad4] bg-white px-3 text-sm font-semibold text-[#4d4b48] shadow-sm transition hover:bg-[#f7f4f1] focus:outline-none focus:ring-2 focus:ring-[#d95d47] focus:ring-offset-2 dark:border-[#494642] dark:bg-[#262421] dark:text-[#ece8e3] dark:hover:bg-[#34312d] dark:focus:ring-offset-[#1b1a18]"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
