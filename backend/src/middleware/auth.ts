import { clerkClient, getAuth } from "@clerk/express";
import type { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import prisma from "../prisma";

function starterWorkspace(): Prisma.FolderCreateNestedManyWithoutUserInput {
  // Nested Prisma writes describe related records from the outside in:
  // User -> Folder -> Bucket -> Task -> Subtask. Prisma executes this one
  // create operation atomically, so a failed onboarding setup cannot leave a
  // new user with only part of the starter workspace.
  return {
    create: {
      name: "Getting Started",
      buckets: {
        create: [
          {
            name: "Start Here",
            description: "This folder is your learning space. Folders group related buckets together, like projects, life areas, or clients.",
            tasks: {
              create: [
                {
                  title: "Open a task to see its details",
                  description: "Select a task title to open its page. Each task can contain a description and subtasks.",
                  importance: "GREEN",
                  subtasks: {
                    create: [
                      { title: "Read the task description" },
                      { title: "Look below for the subtasks section" },
                    ],
                  },
                },
                {
                  title: "This is your learning space",
                  description: "These examples are ordinary items. Rename them, mark them complete, or delete them whenever you are ready.",
                  importance: "GREEN",
                },
                {
                  title: "Folders keep related work together",
                  description: "Create a folder for a project, area of life, or client so its buckets and tasks stay in one place.",
                  importance: "GREEN",
                },
              ],
            },
          },
          {
            name: "Organize Your Work",
            description: "Buckets are groups inside a folder. Use them to divide a project into useful categories.",
            tasks: {
              create: [
                {
                  title: "Create a bucket",
                  description: "Create a bucket when you need another group within a folder. For example: Planning, In Progress, or Finished.",
                  importance: "GREEN",
                },
                {
                  title: "Create a task",
                  description: "Create tasks inside a bucket for the individual actions you want to complete.",
                  importance: "GREEN",
                  subtasks: {
                    create: [
                      { title: "Choose a clear action to complete" },
                      { title: "Add it to the bucket where it belongs" },
                    ],
                  },
                },
                {
                  title: "Name tasks as actions",
                  description: "A useful task title says exactly what you plan to do, such as “Send the proposal” instead of “Proposal.”",
                  importance: "GREEN",
                },
              ],
            },
          },
          {
            name: "Track Progress",
            description: "Use completion and importance to focus on the work that matters most.",
            tasks: {
              create: [
                {
                  title: "Mark this task complete",
                  description: "Use the circle beside a task to mark it complete. Select it again to reopen the task.",
                  importance: "AMBER",
                },
                {
                  title: "Choose an importance color",
                  description: "Green is low urgency, amber needs attention soon, and red is most urgent. Select a color dot to change it.",
                  importance: "RED",
                },
              ],
            },
          },
        ],
      },
    },
  };
}

// This middleware translates Clerk's external user ID into our own database user.
// Routes use the internal ID because Folder.userId has a foreign key to User.id.
export async function requireAppUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated || !userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Most requests only need this quick local database lookup.
    let appUser = await prisma.user.findUnique({ where: { authId: userId } });

    if (!appUser) {
      // Clerk owns login details, so we ask it for the email only when creating
      // the matching application user for the first time.
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.primaryEmailAddress?.emailAddress;

      if (!email) {
        return res.status(422).json({
          error: "Your Clerk account needs a primary email address.",
        });
      }

      // The starter workspace belongs only in create. On later requests the
      // empty update branch returns the existing user without duplicating any
      // example folders, buckets, tasks, or subtasks.
      appUser = await prisma.user.upsert({
        where: { authId: userId },
        update: {},
        create: { authId: userId, email, folders: starterWorkspace() },
      });
    }

    // Express gives middleware a shared per-request storage object. Every API
    // handler can now use res.locals.user.id without querying Clerk again.
    res.locals.user = appUser;
    return next();
  } catch (error) {
    console.error("Authentication setup error:", error);
    return res.status(500).json({
      error: "Could not prepare the authenticated user.",
    });
  }
}
