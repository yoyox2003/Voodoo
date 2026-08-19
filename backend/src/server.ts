import express from "express"; // This is the nodejs backend framework
import cors from "cors";
import dotenv from "dotenv"; // This is to load env variables
import prisma from "./prisma";
import { clerkMiddleware, getAuth } from "@clerk/express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(clerkMiddleware());
app.use(express.json());

// ================================================================================================
// apis for Folder
// ================================================================================================

// GET all folders in database. Will change it to be user specific later
app.get("/api/folders", async (req, res) => {
  // Getting the user from clerk
  const { isAuthenticated, userId } = getAuth(req);

  // Checking if user is valid
  if (!isAuthenticated || !userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Sending the folders back to frontend as JSON
    return res.status(200).json(folders);
  } catch (error) {
    console.error("Get folder error: ", error);

    return res.status(500).json({
      error: "Failed to fetch folders",
    });
  }
});

// Adding a foler to the database. Has a test user now so will change to real user later
app.post("/api/folders", async (req, res) => {
  // Getting the user from clerk
  const { isAuthenticated, userId } = getAuth(req);

  // Checking if user is valid
  if (!isAuthenticated || !userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name } = req.body;

  // If condition to check if data is valid before sending it
  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Folder name is required",
    });
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId, // Use authentication id
      },
    });

    // Returning folder to frontend
    return res.status(201).json(folder);
  } catch (error) {
    console.error("Create folder error: ", error);
    return res.status(500).json({
      error: "Failed to create folder",
    });
  }
});

// Updating the name of a folder
app.put("/api/folders/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Making sure the name exists and is a real string
  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Folder name is required",
    });
  }

  try {
    const updatedFolder = await prisma.folder.update({
      where: {
        id,
      },
      data: {
        name: name.trim(),
      },
    });

    // Send the updated folder back to frontend
    return res.status(200).json(updatedFolder);
  } catch (error) {
    console.error("Update folder error: ", error);
    return res.status(500).json({
      error: "Failed to update folder",
    });
  }
});

// Deleting a folder
// Deletig a folder should also delete all buckets and tasks under it.
app.delete("/api/folders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.folder.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete folder error", error);
    return res.status(500).json({
      error: "Failed to delete folder",
    });
  }
});

// ================================================================================================
// apis for bucket
// ================================================================================================

// get all buckets in database, will change later to only show per user
app.get("/api/buckets", async (req, res) => {
  // Getting the user from clerk
  const { isAuthenticated, userId } = getAuth(req);

  // Checking if user is valid
  if (!isAuthenticated || !userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const buckets = await prisma.bucket.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(buckets);
  } catch (error) {
    console.error("Get buckets error: ", error);
    return res.status(500).json({
      error: "Failed to get buckets",
    });
  }
});

// add a bucket to database
app.post("/api/folders/:foldersId/buckets", async (req, res) => {
  const { foldersId } = req.params;
  const { name } = req.body;

  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Enter a valid name",
    });
  }

  try {
    const bucket = await prisma.bucket.create({
      data: {
        name: name.trim(),
        folderId: foldersId,
      },
    });

    return res.status(201).json(bucket);
  } catch (error) {
    console.error("Create bucket error: ", error);
    return res.status(500).json({
      error: "Failed to create bucket",
    });
  }
});

// Update bucket name
app.put("/api/buckets/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Check if name is valid first
  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Bucket name is required",
    });
  }

  try {
    const bucket = await prisma.bucket.update({
      where: {
        id,
      },
      data: {
        name: name.trim(),
      },
    });

    return res.status(200).json(bucket);
  } catch (error) {
    console.error("Update bucket error: ", error);
    return res.status(500).json({
      error: "Failed to update bucket",
    });
  }
});

// Deleting a bucket.
// Deleting a bucket should also delete all tasks under it. will implement later
app.delete("/api/buckets/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.bucket.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete bucket error: ", error);
    return res.status(500).json({
      error: "Failed to delete bucket",
    });
  }
});

// ================================================================================================
// apis for bucket
// ================================================================================================

// Getting all tasks in the database, will change to be per bucket later
app.get("/api/tasks", async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("Get tasks error: ", error);
    return res.status(500).json({
      error: "Failed to get tasks",
    });
  }
});

// Adding a task. Must be in a bucket
app.post("/api/buckets/:bucketId/tasks", async (req, res) => {
  const { bucketId } = req.params;
  const { name } = req.body;

  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Enter a valid name",
    });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title: name.trim(),
        bucketId,
      },
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("Create task error: ", error);
    return res.status(500).json({
      error: "Failed to create task ",
    });
  }
});

// Updating task name
app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Enter a valid name",
    });
  }

  try {
    const task = await prisma.task.update({
      where: {
        id,
      },
      data: {
        title: name.trim(),
      },
    });

    return res.status(200).json(task);
  } catch (error) {
    console.error("Update task error: ", error);
    return res.status(500).json({
      error: "Failed to update task ",
    });
  }
});

// Deleting a task
// it should also delete all subtasks under it. will add later
app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.task.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete task error", error);
    return res.status(500).json({
      error: "Failed to delete task",
    });
  }
});

// ================================================================================================
// apis for subtask
// ================================================================================================

// get all subtasks in database, will change later to only show per task later
app.get("/api/subtasks", async (_req, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(subtasks);
  } catch (error) {
    console.error("Get subtasks error: ", error);
    return res.status(500).json({
      error: "Failed to get subtasks",
    });
  }
});

// add a subtask to database
app.post("/api/tasks/:taskId/subtasks", async (req, res) => {
  const { taskId } = req.params;
  const { name } = req.body;

  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Enter a valid name",
    });
  }

  try {
    const subtask = await prisma.subtask.create({
      data: {
        title: name.trim(),
        taskId,
      },
    });

    return res.status(201).json(subtask);
  } catch (error) {
    console.error("Create subtask error: ", error);
    return res.status(500).json({
      error: "Failed to create subtask",
    });
  }
});

// Updating the name of a subtask
app.put("/api/subtasks/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      error: "Enter a valid name",
    });
  }

  try {
    const subtask = await prisma.subtask.update({
      where: {
        id,
      },
      data: {
        title: name.trim(),
      },
    });

    return res.status(200).json(subtask);
  } catch (error) {
    console.error("Update subtask error: ", error);
    return res.status(500).json({
      error: "Failed to update subtask",
    });
  }
});

// Deleting a subtask
app.delete("/api/subtasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.subtask.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete subtask error", error);
    return res.status(500).json({
      error: "Failed to delete subtask",
    });
  }
});

// ================================================================================================
// Health check and server start
// ================================================================================================
app.get("/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
