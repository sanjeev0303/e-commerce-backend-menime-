import { clerkClient, requireAuth } from "@clerk/express";
import { NextFunction, Request, Response } from "express";
import { ENV } from "../config";
import { prisma } from "../config/prisma";

export const protectRoute = [
    requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const auth = req.auth();
            const clerkId = auth.userId;
            if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" })

            let user = await prisma.user.findUnique({
                where: { clerkId }
            });

            // Auto-create user if they don't exist in our database
            if (!user) {
                try {
                    // Fetch user data from Clerk
                    const clerkUser = await clerkClient.users.getUser(clerkId);

                    const email = clerkUser.emailAddresses[0]?.emailAddress;
                    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
                    const imageUrl = clerkUser.imageUrl;

                    if (!email) {
                        return res.status(400).json({ message: "User email not found" });
                    }

                    user = await prisma.user.create({
                        data: {
                            clerkId,
                            email,
                            name,
                            imageUrl,
                        },
                    });

                    console.log(`✅ Auto-created user: ${email}`);
                } catch (createError) {
                    console.error("Error auto-creating user:", createError);
                    return res.status(500).json({ message: "Failed to create user" });
                }
            }

            req.user = user;

            next();
        } catch (error) {
            console.error("Error in protectRoute middleware", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
]


export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - user not found" });
  }

  if (req.user.email !== ENV.ADMIN_EMAIL) {
    return res.status(403).json({ message: "Forbidden - admin access only" });
  }

  next();
};
