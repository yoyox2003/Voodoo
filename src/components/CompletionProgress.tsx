import type { CSSProperties } from "react";

export function CompletionProgress({ label, value }: { label: string; value: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  const color = { "--progress-hue": percent * 1.2 } as CSSProperties;
  return (
    <div aria-label={`${label}: ${percent}% complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="ml-auto flex shrink-0 items-center justify-end gap-2 text-xs text-[hsl(var(--progress-hue)_80%_25%)] dark:text-[hsl(var(--progress-hue)_85%_70%)]" role="progressbar" style={color}>
      <span aria-hidden="true" className="h-1.5 w-12 overflow-hidden rounded-full bg-[#eee9e4] dark:bg-[#49423b]">
        <span className="block h-full rounded-full bg-current" style={{ width: `${percent}%` }} />
      </span>
      <span aria-hidden="true" className="w-8 text-right tabular-nums">{percent}%</span>
    </div>
  );
}
