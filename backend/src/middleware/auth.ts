import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import prisma from "../prisma";

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

      // upsert also prevents duplicate users if two first requests arrive together.
      appUser = await prisma.user.upsert({
        where: { authId: userId },
        update: {},
        create: { authId: userId, email },
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
