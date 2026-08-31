import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedApi } from "./useAuthenticatedApi";
import type { Bucket, Folder, Subtask, Task } from "../types/entities";

export function apiQueryKey(userId: string | null | undefined, path: string) {
  return ["api", userId, path] as const;
}

export type WorkspaceData = {
  buckets: Bucket[];
  error: unknown;
  folders: Folder[];
  isError: boolean;
  isLoading: boolean;
  subtasks: Subtask[];
  tasks: Task[];
};

// The four lists are independent, so calling their queries together starts all
// requests in parallel. TanStack Query also shares these keys with the tester.
export function useWorkspaceData(): WorkspaceData {
  const request = useAuthenticatedApi();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const enabled = isLoaded && isSignedIn && Boolean(userId);

  const foldersQuery = useQuery({
    queryKey: apiQueryKey(userId, "/api/folders"),
    queryFn: () => request<Folder[]>("/api/folders"),
    enabled,
  });
  const bucketsQuery = useQuery({
    queryKey: apiQueryKey(userId, "/api/buckets"),
    queryFn: () => request<Bucket[]>("/api/buckets"),
    enabled,
  });
  const tasksQuery = useQuery({
    queryKey: apiQueryKey(userId, "/api/tasks"),
    queryFn: () => request<Task[]>("/api/tasks"),
    enabled,
  });
  const subtasksQuery = useQuery({
    queryKey: apiQueryKey(userId, "/api/subtasks"),
    queryFn: () => request<Subtask[]>("/api/subtasks"),
    enabled,
  });

  const queries = [foldersQuery, bucketsQuery, tasksQuery, subtasksQuery];

  return {
    folders: foldersQuery.data ?? [],
    buckets: bucketsQuery.data ?? [],
    tasks: tasksQuery.data ?? [],
    subtasks: subtasksQuery.data ?? [],
    isLoading: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error,
  };
}
