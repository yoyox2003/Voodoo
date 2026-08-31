import { useOutletContext } from "react-router";
import type { WorkspaceData } from "./useWorkspaceData";

export function useWorkspaceOutlet() {
  return useOutletContext<WorkspaceData>();
}
