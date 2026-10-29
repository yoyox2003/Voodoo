// These types mirror the fields returned by the current Prisma API routes.
// Keeping them here lets React catch mistakes such as using `name` on a Task,
// whose database field is called `title`.

export type EntityKind = "folder" | "bucket" | "task" | "subtask";

export type Folder = {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
};

export type Bucket = {
  id: string;
  name: string;
  description: string | null;
  folderId: string;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  importance: "GREEN" | "AMBER" | "RED";
  isDone: boolean;
  position: number;
  bucketId: string;
  createdAt: string;
};

export type Subtask = {
  id: string;
  title: string;
  isDone: boolean;
  position: number;
  taskId: string;
  createdAt: string;
};

export type EntityRecord = Folder | Bucket | Task | Subtask;

export const entityLabels: Record<EntityKind, string> = {
  folder: "Folders",
  bucket: "Buckets",
  task: "Tasks",
  subtask: "Subtasks",
};

export function recordName(record: EntityRecord): string {
  // Folders and buckets use `name`; tasks and subtasks use `title`.
  return "name" in record ? record.name : record.title;
}
