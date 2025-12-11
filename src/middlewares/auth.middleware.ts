import { requireAuth } from "@clerk/express";
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

            const user = await prisma.user.findUnique({
                where: { clerkId }
            });

            if (!user) return res.status(404).json({ message: "User not found" });

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
