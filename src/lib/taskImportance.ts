import type { Task } from "../types/entities";

export const importanceLabels: Record<Task["importance"], string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
};

export const importanceColorClasses: Record<Task["importance"], string> = {
  GREEN: "bg-[#4c9b68]",
  AMBER: "bg-[#d48806]",
  RED: "bg-[#d95d47]",
};
