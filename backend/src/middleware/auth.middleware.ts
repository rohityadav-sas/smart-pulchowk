import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";
import ENV from "../config/ENV.js";

const getAuthToken = (req: Request): string | null => {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length).trim();
    }

    const queryToken = req.query.token as string | undefined;
    return queryToken || null;
};

const loadFirebaseServiceAccount = () => {
    try {
        if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
            return JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
        }
    } catch (error) {
        console.error("Failed to load Firebase service account:", error);
    }

    return null;
};

const getFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        return admin;
    }

    const serviceAccount = loadFirebaseServiceAccount();
    if (!serviceAccount) {
        return null;
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    return admin;
};

const verifyFirebaseToken = async (token: string) => {
    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
        return null;
    }

    try {
        return await firebaseAdmin.auth().verifyIdToken(token);
    } catch (error) {
        console.warn("Firebase token verification failed:", error);
        return null;
    }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (session) {
        (req as any).user = session.user;
        (req as any).session = session.session;
        return next();
    }

    const token = getAuthToken(req);
    if (token) {
        // First try Firebase token verification
        try {
            const decoded = await verifyFirebaseToken(token);

            if (decoded) {
                let dbUser = await db.query.user.findFirst({
                    where: eq(user.id, decoded.uid),
                });

                if (!dbUser && decoded.email) {
                    dbUser = await db.query.user.findFirst({
                        where: eq(user.email, decoded.email),
                    });
                }

                if (dbUser) {
                    (req as any).user = dbUser;
                    (req as any).session = { userId: dbUser.id, authType: "firebase" };
                }
            }
        } catch (error) {
            console.error("Firebase token verification error:", error);
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
        const token = getAuthToken(req);

        if (token) {
            // First try Firebase token verification
            try {
                const decoded = await verifyFirebaseToken(token);
                if (decoded) {
                    let dbUser = await db.query.user.findFirst({
                        where: eq(user.id, decoded.uid),
                    });

                    if (!dbUser && decoded.email) {
                        dbUser = await db.query.user.findFirst({
                            where: eq(user.email, decoded.email),
                        });
                    }

                    if (dbUser) {
                        (req as any).user = dbUser;
                        (req as any).session = { userId: dbUser.id, authType: "firebase" };
                    }
                }
            } catch (error) {
                console.error("Firebase token verification error in optionalAuth:", error);
            }
        }
    }

    next();
};

export const requireFirebaseAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = getAuthToken(req);
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = await verifyFirebaseToken(token);
    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    (req as any).firebaseUser = decoded;
    return next();
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
