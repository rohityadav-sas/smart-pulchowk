import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (session) {
        (req as any).user = session.user;
        (req as any).session = session.session;
        return next();
    }

    // Fallback for Mobile App: Check Authorization header for User ID
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const userId = authHeader.split(' ')[1];
        try {
            const dbUser = await db.query.user.findFirst({
                where: eq(user.id, userId),
            });

            if (dbUser) {
                (req as any).user = dbUser;
                (req as any).session = { userId: dbUser.id }; // Mock session
                return next();
            }
        } catch (error) {
            console.error("Auth middleware error:", error);
        }
    }

    return res.status(401).json({ message: "Unauthorized" });
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (session) {
        (req as any).user = session.user;
        (req as any).session = session.session;
    } else {

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const userId = authHeader.split(' ')[1];
            try {
                const dbUser = await db.query.user.findFirst({
                    where: eq(user.id, userId),
                });

                if (dbUser) {
                    (req as any).user = dbUser;
                    (req as any).session = { userId: dbUser.id }; 
                }
            } catch (error) {
                console.error("Auth middleware error:", error);
            }
        }
    }

    next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // Ensure requireAuth is run first
    const user = (req as any).user;

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Only authorized personnel can create clubs" });
    }

    next();
};

export const requireTeacher = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "teacher") {
        return res.status(403).json({ message: "Forbidden: Teacher access required" });
    }

    next();
};
