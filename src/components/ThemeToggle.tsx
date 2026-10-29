import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={`inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold text-[#4d4b48] transition hover:bg-[#f3f1ef] focus:outline-none dark:text-[#ece8e3] dark:hover:bg-[#302d29] ${compact ? "h-8 w-8" : "h-10 border border-[#dedad4] bg-white px-3 shadow-sm dark:border-[#494642] dark:bg-[#262421]"}`}
      onClick={toggleTheme}
      type="button"
    >
      {isDark ? (
        <Sun aria-hidden="true" size={compact ? 16 : 17} />
      ) : (
        <Moon aria-hidden="true" size={compact ? 16 : 17} />
      )}
      {!compact && <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
