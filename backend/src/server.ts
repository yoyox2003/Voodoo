import express from "express"; // This is the nodejs backend framework
import cors from "cors";
import dotenv from "dotenv"; // This is to load env variables
import prisma from "./prisma";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

// ================================================================================================
// apis for Folder
// ================================================================================================

app.get("/api/folders", async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      orderBy: {
        createdAt: "desc",
      },
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

app.post("/api/folders", async (req, res) => {
  const { name } = req.body;

  // If condition to check if data is valid before sending it
  if (!name || typeof name != "string" || !name.trim()) {
    return res.status(400).json({
      errer: "Folder name is required",
    });
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId: "test-user-1",
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

app.get("/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
