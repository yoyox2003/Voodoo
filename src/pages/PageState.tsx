import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

type PageFrameProps = { children: ReactNode; eyebrow?: string; title: ReactNode };

export function PageFrame({ children, eyebrow, title }: PageFrameProps) {
  return <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
    {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c84b37] dark:text-[#ff9d87]">{eyebrow}</p>}
    <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-[32px]">{title}</h1>
    {children}
  </main>;
}

export function WorkspacePageStatus({ error, isError, isLoading }: { error: unknown; isError: boolean; isLoading: boolean }) {
  if (isLoading) return <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading your workspace…</p>;
  if (!isError) return null;
  const message = error instanceof ApiError || error instanceof Error ? error.message : "Unable to load your workspace.";
  return <p className="mt-10 border-l-2 border-[#c84b37] bg-[#fff5f1] px-4 py-3 text-sm text-[#9f3d2c] dark:bg-[#3d2722] dark:text-[#ffad9b]" role="alert">{message}</p>;
}
