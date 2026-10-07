import type { Task } from "../types/entities";
import { importanceColorClasses, importanceLabels } from "../lib/taskImportance";

type TaskImportanceProps = {
  importance: Task["importance"];
};

// The visible dot stays text-free, while its label and title make the colour
// understandable to screen-reader users and people who hover it.
export function TaskImportance({ importance }: TaskImportanceProps) {
  const label = importanceLabels[importance];
  return (
    <span
      aria-label={`Importance: ${label}`}
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${importanceColorClasses[importance]}`}
      role="img"
      title={`Importance: ${label}`}
    />
  );
}
