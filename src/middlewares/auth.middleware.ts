import { clerkClient, requireAuth } from "@clerk/express";
import { NextFunction, Request, Response } from "express";
import { ENV } from "../config";
import { prisma } from "../config/prisma";

export const protectRoute = [
    requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log("🔒 protectRoute: Processing request to:", req.path);
            
            const auth = req.auth();
            const clerkId = auth.userId;
            
            console.log("🔑 protectRoute: Clerk ID from token:", clerkId);
            
            if (!clerkId) {
                console.log("❌ protectRoute: No clerkId in token");
                return res.status(401).json({ message: "Unauthorized - invalid token" })
            }

            console.log("🔍 protectRoute: Looking up user in database...");
            let user = await prisma.user.findUnique({
                where: { clerkId }
            });

            console.log("📦 protectRoute: User found in DB:", user ? `Yes (${user.email})` : "No");

            // Auto-create user if they don't exist in our database
            if (!user) {
                console.log("🆕 protectRoute: Auto-creating user...");
                try {
                    // Fetch user data from Clerk
                    console.log("📡 protectRoute: Fetching user from Clerk API...");
                    const clerkUser = await clerkClient.users.getUser(clerkId);
                    console.log("✅ protectRoute: Clerk user fetched:", clerkUser.emailAddresses?.[0]?.emailAddress);

                    const email = clerkUser.emailAddresses[0]?.emailAddress;
                    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
                    const imageUrl = clerkUser.imageUrl;

                    console.log("📝 protectRoute: Creating user with:", { email, name, clerkId });

                    if (!email) {
                        console.log("❌ protectRoute: No email found in Clerk user");
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

                    console.log(`✅ protectRoute: Auto-created user: ${email} (ID: ${user.id})`);
                } catch (createError) {
                    console.error("❌ protectRoute: Error auto-creating user:", createError);
                    return res.status(500).json({ message: "Failed to create user" });
                }
            }

            req.user = user;
            console.log("✅ protectRoute: User attached to request, proceeding...");

            next();
        } catch (error) {
            console.error("❌ protectRoute: Error in middleware:", error);
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
