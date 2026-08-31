import { Check, Circle } from "lucide-react";

type TaskMarkerProps = { done?: boolean };

export function TaskMarker({ done = false }: TaskMarkerProps) {
  return done ? <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#c84b37] text-white"><Check size={13} strokeWidth={3} /></span>
    : <Circle aria-hidden="true" className="shrink-0 text-[#a49b94] dark:text-[#847b74]" size={21} strokeWidth={1.5} />;
}
