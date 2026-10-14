import { useEffect, useState } from "react";
import { localDateKey } from "../lib/dueDates";

// Refresh at local midnight and when returning to a sleeping/background tab.
export function useLocalToday(): string {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(localDateKey(now));
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 100);
    }
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
