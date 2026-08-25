import { UserButton, useUser } from "@clerk/react";
import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import type { EntityKind } from "../types/entities";
import { EntityTabs } from "./EntityTabs";
import { ThemeToggle } from "./ThemeToggle";

type AppShellProps = {
  activeEntity: EntityKind;
  children: ReactNode;
  onEntityChange: (entity: EntityKind) => void;
};

export function AppShell({ activeEntity, children, onEntityChange }: AppShellProps) {
  const { user } = useUser();
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-white text-[#292827] transition-colors dark:bg-[#1b1a18] dark:text-[#f3efea] md:flex">
      <aside className="border-b border-[#e7e2dc] bg-[#faf8f5] p-4 transition-colors dark:border-[#3d3935] dark:bg-[#211f1d] md:min-h-screen md:w-64 md:border-r md:border-b-0 md:p-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d95d47] text-lg font-black text-white">
            ✓
          </div>
          <div>
            <p className="font-bold">TooDoo</p>
            <p className="text-xs text-[#8b8580] dark:text-[#a9a19a]">API playground</p>
          </div>
        </div>

        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-[#918b85] dark:text-[#aaa29b]">
          Test resources
        </p>
        <EntityTabs activeEntity={activeEntity} onChange={onEntityChange} />

        <div className="mt-8 rounded-xl border border-[#e7e2dc] bg-white p-3 text-xs leading-5 text-[#77716b] dark:border-[#45413c] dark:bg-[#2a2825] dark:text-[#b9b1aa]">
          Create parents before children: folders hold buckets, buckets hold tasks, and tasks hold
          subtasks.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-[#efebe7] px-5 py-4 dark:border-[#383531] sm:px-8">
          <div>
            <p className="text-sm font-medium text-[#77716b] dark:text-[#aaa29b]">Signed in as</p>
            <p className="text-sm font-semibold">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserButton
              appearance={{
                variables:
                  theme === "dark"
                    ? {
                        colorBackground: "#262421",
                        colorForeground: "#f3efea",
                        colorMutedForeground: "#b9b1aa",
                        colorNeutral: "#f3efea",
                        colorPrimary: "#d95d47",
                      }
                    : undefined,
              }}
            />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
