import { clerkMiddleware } from "@clerk/express";
import type { User } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Response } from "express";
import { requireAppUser } from "./middleware/auth";
import prisma from "./prisma";

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

    await prisma.folder.delete({ where: { id: folder.id } });
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

    await prisma.bucket.delete({ where: { id: bucket.id } });
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
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/buckets/:bucketId/tasks", async (req, res) => {
  const { bucketId } = req.params;
  const { name } = req.body;

  if (!validName(name)) {
    return res.status(400).json({ error: "Task name is required" });
  }

  try {
    const bucket = await prisma.bucket.findFirst({
      where: { id: bucketId, folder: { userId: currentUserId(res) } },
    });

    if (!bucket) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    const task = await prisma.task.create({
      data: { title: name.trim(), bucketId: bucket.id },
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({ error: "Failed to create task" });
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

    await prisma.task.delete({ where: { id: task.id } });
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
      orderBy: { createdAt: "desc" },
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

    const subtask = await prisma.subtask.create({
      data: { title: name.trim(), taskId: task.id },
    });

    return res.status(201).json(subtask);
  } catch (error) {
    console.error("Create subtask error:", error);
    return res.status(500).json({ error: "Failed to create subtask" });
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
