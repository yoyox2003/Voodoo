import { lazy, Suspense } from "react";

// Load the calendar library only when visiting its page.
const CalendarPage = lazy(() =>
  import("./CalendarPage").then((module) => ({ default: module.CalendarPage })),
);

export function CalendarRoute() {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading calendar…</p>}
    >
      <CalendarPage />
    </Suspense>
  );
}
