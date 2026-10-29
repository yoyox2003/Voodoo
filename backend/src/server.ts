import { clerkMiddleware } from "@clerk/express";
import { Importance, type User } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Response } from "express";
import { requireAppUser } from "./middleware/auth";
import prisma from "./prisma";
import { parseDueDate } from "./dueDate";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

// Clerk reads the bearer token before our own middleware decides whether a route
// is private. CORS lets the Vite frontend call this separate local server.
app.use(clerkMiddleware());
app.use(cors());
app.use(express.json());

// All API routes need a signed-in Clerk user and a matching Prisma User record.
app.use("/api", requireAppUser);

// This helper makes it clear that database ownership always uses User.id, not
// Clerk's external user ID.
function currentUserId(res: Response): string {
  return (res.locals.user as User).id;
}

function validName(name: unknown): name is string {
  return typeof name === "string" && Boolean(name.trim());
}

// Use Prisma's generated enum so request validation matches the database's
// allowed importance values. A TypeScript type alone cannot validate JSON.
function validImportance(value: unknown): value is Importance {
  return typeof value === "string" &&
    Object.values(Importance).some((importance) => importance === value);
}

// Forms may omit description, clear it with null, or send text. Trim here so
// the database does not collect descriptions made only of spaces.
function parseDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return undefined;
  return value.trim() || null;
}

// ================================================================================================
// Folder APIs
// ================================================================================================

app.get("/api/folders", async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: currentUserId(res) },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(folders);
  } catch (error) {
    console.error("Get folders error:", error);
    return res.status(500).json({ error: "Failed to fetch folders" });
  }
});

app.post("/api/folders", async (req, res) => {
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Folder name is required" });
  }

  try {
    const folder = await prisma.folder.create({
      data: { name: name.trim(), userId: currentUserId(res) },
    });

    return res.status(201).json(folder);
  } catch (error) {
    console.error("Create folder error:", error);
    return res.status(500).json({ error: "Failed to create folder" });
  }
});

app.put("/api/folders/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Folder name is required" });
  }

  try {
    const folder = await prisma.folder.findFirst({
      where: { id, userId: currentUserId(res) },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: folder.id },
      data: { name: name.trim() },
    });

    return res.status(200).json(updatedFolder);
  } catch (error) {
    console.error("Update folder error:", error);
    return res.status(500).json({ error: "Failed to update folder" });
  }
});

app.delete("/api/folders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const folder = await prisma.folder.findFirst({
      where: { id, userId: currentUserId(res) },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // A transaction groups these queries into one all-or-nothing operation.
    // If any delete fails, Prisma rolls back the earlier deletes, so the folder
    // is never left half-deleted with only some of its children removed.
    await prisma.$transaction(async (transaction) => {
      // Postgres protects relationships with foreign keys, so we must delete
      // the deepest children first. Every subtask belongs to a task, whose
      // bucket belongs to this folder.
      await transaction.subtask.deleteMany({
        where: {
          task: {
            bucket: {
              folderId: folder.id,
            },
          },
        },
      });

      // Once no subtasks point at the tasks, deleting all tasks in the folder's
      // buckets is safe. deleteMany also succeeds when there are no tasks.
      await transaction.task.deleteMany({
        where: {
          bucket: {
            folderId: folder.id,
          },
        },
      });

      // Tasks no longer point at these buckets, so remove the buckets next.
      await transaction.bucket.deleteMany({
        where: { folderId: folder.id },
      });

      // The folder is last because its buckets used to reference it.
      await transaction.folder.delete({ where: { id: folder.id } });
    });
    return res.status(204).send();
  } catch (error) {
    console.error("Delete folder error:", error);
    return res.status(500).json({ error: "Failed to delete folder" });
  }
});

// ================================================================================================
// Bucket APIs
// ================================================================================================

app.get("/api/buckets", async (_req, res) => {
  try {
    const buckets = await prisma.bucket.findMany({
      where: { folder: { userId: currentUserId(res) } },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(buckets);
  } catch (error) {
    console.error("Get buckets error:", error);
    return res.status(500).json({ error: "Failed to fetch buckets" });
  }
});

app.post("/api/folders/:foldersId/buckets", async (req, res) => {
  const { foldersId } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Bucket name is required" });
  }

  try {
    const folder = await prisma.folder.findFirst({
      where: { id: foldersId, userId: currentUserId(res) },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const bucket = await prisma.bucket.create({
      data: { name: name.trim(), folderId: folder.id },
    });

    return res.status(201).json(bucket);
  } catch (error) {
    console.error("Create bucket error:", error);
    return res.status(500).json({ error: "Failed to create bucket" });
  }
});

app.put("/api/buckets/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Bucket name is required" });
  }

  try {
    const bucket = await prisma.bucket.findFirst({
      where: { id, folder: { userId: currentUserId(res) } },
    });

    if (!bucket) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    const updatedBucket = await prisma.bucket.update({
      where: { id: bucket.id },
      data: { name: name.trim() },
    });

    return res.status(200).json(updatedBucket);
  } catch (error) {
    console.error("Update bucket error:", error);
    return res.status(500).json({ error: "Failed to update bucket" });
  }
});

app.delete("/api/buckets/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const bucket = await prisma.bucket.findFirst({
      where: { id, folder: { userId: currentUserId(res) } },
    });

    if (!bucket) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.subtask.deleteMany({
        where: {
          task: {
            bucketId: bucket.id,
          },
        },
      });

      await transaction.task.deleteMany({
        where: {
          bucketId: id,
        },
      });

      await transaction.bucket.delete({ where: { id: bucket.id } });
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete bucket error:", error);
    return res.status(500).json({ error: "Failed to delete bucket" });
  }
});

// ================================================================================================
// Task APIs
// ================================================================================================

app.get("/api/tasks", async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { bucket: { folder: { userId: currentUserId(res) } } },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/buckets/:bucketId/tasks", async (req, res) => {
  const { bucketId } = req.params;
  const { name, importance, description, dueDate } = req.body ?? {};
  const parsedDescription = parseDescription(description);
  const parsedDueDate = dueDate === undefined ? undefined : parseDueDate(dueDate);

  if (!validName(name)) {
    return res.status(400).json({ error: "Task name is required" });
  }

  if (importance !== undefined && !validImportance(importance)) {
    return res.status(400).json({ error: "Importance must be GREEN, AMBER, or RED" });
  }

  if (description !== undefined && parsedDescription === undefined) {
    return res.status(400).json({ error: "Description must be text or null" });
  }

  if (dueDate !== undefined && parsedDueDate === undefined) {
    return res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD date or null" });
  }

  try {
    const bucket = await prisma.bucket.findFirst({
      where: { id: bucketId, folder: { userId: currentUserId(res) } },
    });

    if (!bucket) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    const last = await prisma.task.aggregate({ where: { bucketId: bucket.id }, _max: { position: true } });
    const task = await prisma.task.create({
      // Omitted importance uses the schema's GREEN default. We do not set
      // isDone here, so Prisma uses the schema's false default for new tasks.
      data: {
        title: name.trim(),
        bucketId: bucket.id,
        position: (last._max.position ?? -1) + 1,
        ...(importance !== undefined ? { importance } : {}),
        ...(description !== undefined ? { description: parsedDescription } : {}),
        ...(dueDate !== undefined ? { dueDate: parsedDueDate } : {}),
      },
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

// Sort only when requested, preserving the current order within each priority.
app.patch("/api/buckets/:bucketId/tasks/sort", async (req, res) => {
  try {
    const tasks = await prisma.$transaction(async (tx) => {
      const bucket = await tx.bucket.findFirst({
        where: { id: req.params.bucketId, folder: { userId: currentUserId(res) } },
      });
      if (!bucket) return null;

      const ordered = await tx.task.findMany({
        where: { bucketId: bucket.id },
        orderBy: [{ position: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      });
      const priority = { RED: 0, AMBER: 1, GREEN: 2 };
      ordered.sort((a, b) => priority[a.importance] - priority[b.importance]);
      for (let position = 0; position < ordered.length; position++) {
        await tx.task.update({ where: { id: ordered[position].id }, data: { position } });
      }
      return tx.task.findMany({ where: { bucketId: bucket.id }, orderBy: [{ position: "asc" }, { id: "asc" }] });
    }, { isolationLevel: "Serializable" });
    if (!tasks) return res.status(404).json({ error: "Bucket not found" });
    return res.status(200).json(tasks);
  } catch (error) {
    console.error("Sort tasks error:", error);
    return res.status(500).json({ error: "Failed to sort tasks" });
  }
});

// Move a task within a bucket or to another owned bucket. The destination is
// rewritten in one transaction so a failed move cannot leave a partial order.
app.patch("/api/tasks/:id/move", async (req, res) => {
  const { bucketId, beforeTaskId } = req.body ?? {};
  if (typeof bucketId !== "string" || !bucketId || (beforeTaskId !== null && typeof beforeTaskId !== "string")) {
    return res.status(400).json({ error: "Provide a bucketId and a task ID or null for the insertion point" });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: req.params.id, bucket: { folder: { userId: currentUserId(res) } } } });
      const bucket = await tx.bucket.findFirst({ where: { id: bucketId, folder: { userId: currentUserId(res) } } });
      if (!task || !bucket) return { error: "not-found" as const };
      const destination = await tx.task.findMany({ where: { bucketId, id: { not: task.id } }, orderBy: [{ position: "asc" }, { createdAt: "desc" }, { id: "asc" }] });
      const index = beforeTaskId === null ? destination.length : destination.findIndex((item) => item.id === beforeTaskId);
      if (index < 0) return { error: "invalid-position" as const };
      const ordered = [...destination];
      ordered.splice(index, 0, task);
      for (let position = 0; position < ordered.length; position++) {
        await tx.task.update({ where: { id: ordered[position].id }, data: { bucketId, position } });
      }
      return { tasks: await tx.task.findMany({ where: { bucketId }, orderBy: [{ position: "asc" }, { id: "asc" }] }) };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return res.status(result.error === "not-found" ? 404 : 400).json({ error: result.error === "not-found" ? "Task or bucket not found" : "Insertion point is not in the destination bucket" });
    return res.status(200).json(result.tasks);
  } catch (error) {
    console.error("Move task error:", error);
    return res.status(500).json({ error: "Failed to move task" });
  }
});

// PATCH updates only the supplied fields. For example, { isDone: true } leaves
// the task's name, description, due date, and importance unchanged.
app.patch("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { isDone, importance, name, description, dueDate } = req.body ?? {};
  const parsedDescription = parseDescription(description);
  const parsedDueDate = dueDate === undefined ? undefined : parseDueDate(dueDate);

  // Check the actual JSON values before passing them to Prisma. In particular,
  // the string "false" is not the same as the boolean false.
  if (isDone !== undefined && typeof isDone !== "boolean") {
    return res.status(400).json({ error: "isDone must be a boolean" });
  }

  if (importance !== undefined && !validImportance(importance)) {
    return res.status(400).json({ error: "Importance must be GREEN, AMBER, or RED" });
  }

  if (name !== undefined && !validName(name)) {
    return res.status(400).json({ error: "Task name is required" });
  }

  if (description !== undefined && parsedDescription === undefined) {
    return res.status(400).json({ error: "Description must be text or null" });
  }

  if (dueDate !== undefined && parsedDueDate === undefined) {
    return res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD date or null" });
  }

  if (isDone === undefined && importance === undefined && name === undefined && description === undefined && dueDate === undefined) {
    return res.status(400).json({ error: "Provide a task field to update" });
  }

  try {
    // Follow Task -> Bucket -> Folder to check ownership. Returning the same
    // 404 for missing and other users' tasks avoids revealing their records.
    const task = await prisma.task.findFirst({
      where: { id, bucket: { folder: { userId: currentUserId(res) } } },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      // Include only supplied fields so omitted values are preserved. Compare
      // with undefined instead of checking truthiness: false must be saved too,
      // allowing a completed task to be reopened. Prisma writes these changes
      // to the Task row and returns it; no Subtask rows are changed.
      data: {
        ...(isDone !== undefined ? { isDone } : {}),
        ...(importance !== undefined ? { importance } : {}),
        // The API calls this "name" while Prisma calls the Task column "title".
        ...(name !== undefined ? { title: name.trim() } : {}),
        ...(description !== undefined ? { description: parsedDescription } : {}),
        ...(dueDate !== undefined ? { dueDate: parsedDueDate } : {}),
      },
    });

    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Update task status error:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

// This endpoint changes only dueDate; completion, importance, and title are
// preserved. The frontend date input sends YYYY-MM-DD, or null to clear it.
app.patch("/api/tasks/:id/due-date", async (req, res) => {
  const dueDate = parseDueDate(req.body?.dueDate);
  if (dueDate === undefined) {
    return res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD date or null" });
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, bucket: { folder: { userId: currentUserId(res) } } },
    });
    if (!task) return res.status(404).json({ error: "Task not found" });

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: { dueDate },
    });
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Update task due date error:", error);
    return res.status(500).json({ error: "Failed to update task due date" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Task name is required" });
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id, bucket: { folder: { userId: currentUserId(res) } } },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: { title: name.trim() },
    });

    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findFirst({
      where: { id, bucket: { folder: { userId: currentUserId(res) } } },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    await prisma.$transaction(async (transaction) => {
      // first delete subtasks then delete tasks
      await transaction.subtask.deleteMany({ where: { taskId: task.id } });

      await transaction.task.delete({
        where: {
          id,
        },
      });
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

// ================================================================================================
// Subtask APIs
// ================================================================================================

app.get("/api/subtasks", async (_req, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { task: { bucket: { folder: { userId: currentUserId(res) } } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return res.status(200).json(subtasks);
  } catch (error) {
    console.error("Get subtasks error:", error);
    return res.status(500).json({ error: "Failed to fetch subtasks" });
  }
});

app.post("/api/tasks/:taskId/subtasks", async (req, res) => {
  const { taskId } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Subtask name is required" });
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, bucket: { folder: { userId: currentUserId(res) } } },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const last = await prisma.subtask.aggregate({ where: { taskId: task.id }, _max: { position: true } });
    const subtask = await prisma.subtask.create({
      data: { title: name.trim(), taskId: task.id, position: (last._max.position ?? -1) + 1 },
    });

    return res.status(201).json(subtask);
  } catch (error) {
    console.error("Create subtask error:", error);
    return res.status(500).json({ error: "Failed to create subtask" });
  }
});

app.put("/api/tasks/:taskId/subtasks/order", async (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string") || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "Provide a list of distinct subtask IDs" });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: req.params.taskId, bucket: { folder: { userId: currentUserId(res) } } } });
      if (!task) return { error: "not-found" as const };
      const existing = await tx.subtask.findMany({ where: { taskId: task.id }, select: { id: true } });
      const existingIds = new Set(existing.map((item) => item.id));
      if (ids.length !== existing.length || ids.some((id: string) => !existingIds.has(id))) return { error: "conflict" as const };
      for (let position = 0; position < ids.length; position++) {
        await tx.subtask.update({ where: { id: ids[position] }, data: { position } });
      }
      return { subtasks: await tx.subtask.findMany({ where: { taskId: task.id }, orderBy: { position: "asc" } }) };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return res.status(result.error === "not-found" ? 404 : 409).json({ error: result.error === "not-found" ? "Task not found" : "Subtasks changed; refresh and try again" });
    return res.status(200).json(result.subtasks);
  } catch (error) {
    console.error("Reorder subtasks error:", error);
    return res.status(500).json({ error: "Failed to reorder subtasks" });
  }
});

// Subtask completion is independent of its parent task. The frontend sends
// true to complete it or false to reopen it; neither changes the task's status.
app.patch("/api/subtasks/:id", async (req, res) => {
  const { isDone } = req.body ?? {};
  if (typeof isDone !== "boolean") {
    return res.status(400).json({ error: "isDone must be a boolean" });
  }

  try {
    // Follow Subtask -> Task -> Bucket -> Folder before writing. The same 404
    // hides both missing subtasks and records belonging to another user.
    const subtask = await prisma.subtask.findFirst({
      where: {
        id: req.params.id,
        task: { bucket: { folder: { userId: currentUserId(res) } } },
      },
    });
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    const updatedSubtask = await prisma.subtask.update({
      where: { id: subtask.id },
      data: { isDone },
    });
    return res.status(200).json(updatedSubtask);
  } catch (error) {
    console.error("Update subtask completion error:", error);
    return res.status(500).json({ error: "Failed to update subtask" });
  }
});

app.put("/api/subtasks/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Subtask name is required" });
  }

  try {
    const subtask = await prisma.subtask.findFirst({
      where: {
        id,
        task: { bucket: { folder: { userId: currentUserId(res) } } },
      },
    });

    if (!subtask) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    const updatedSubtask = await prisma.subtask.update({
      where: { id: subtask.id },
      data: { title: name.trim() },
    });

    return res.status(200).json(updatedSubtask);
  } catch (error) {
    console.error("Update subtask error:", error);
    return res.status(500).json({ error: "Failed to update subtask" });
  }
});

app.delete("/api/subtasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const subtask = await prisma.subtask.findFirst({
      where: {
        id,
        task: { bucket: { folder: { userId: currentUserId(res) } } },
      },
    });

    if (!subtask) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    await prisma.subtask.delete({ where: { id: subtask.id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Delete subtask error:", error);
    return res.status(500).json({ error: "Failed to delete subtask" });
  }
});

// Health stays public so deployment platforms can verify that the server is alive.
app.get("/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
