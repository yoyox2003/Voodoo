-- Preserve the order users currently see: newest tasks and oldest subtasks first.
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subtask" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "bucketId" ORDER BY "createdAt" DESC, "id") - 1 AS position
  FROM "Task"
)
UPDATE "Task" AS task SET "position" = ranked.position::integer
FROM ranked WHERE task."id" = ranked."id";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "taskId" ORDER BY "createdAt" ASC, "id") - 1 AS position
  FROM "Subtask"
)
UPDATE "Subtask" AS subtask SET "position" = ranked.position::integer
FROM ranked WHERE subtask."id" = ranked."id";
