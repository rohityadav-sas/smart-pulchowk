import express from "express";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";
import { requireFirebaseAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Sync Firebase user to Postgres database
 * This allows Firebase Auth users from the mobile app to be registered in the same database
 * as Better Auth users from the website
 */
router.post("/sync-user", requireFirebaseAuth, async (req, res) => {
    try {
        const firebaseUser = (req as any).firebaseUser as {
            uid?: string;
            email?: string;
            name?: string;
            picture?: string;
            email_verified?: boolean;
        };

        const {
            authStudentId: bodyAuthStudentId,
            email: bodyEmail,
            name: bodyName,
            image: bodyImage,
            fcmToken
        } = req.body;

        const authStudentId = firebaseUser?.uid;
        const tokenEmail = firebaseUser?.email;

        if (bodyAuthStudentId && authStudentId && bodyAuthStudentId !== authStudentId) {
            res.status(403).json({
                data: {
                    success: false,
                    message: "User ID mismatch with Firebase token",
                },
            });
            return;
        }

        if (tokenEmail && bodyEmail && tokenEmail.toLowerCase() !== bodyEmail.toLowerCase()) {
            res.status(403).json({
                data: {
                    success: false,
                    message: "Email mismatch with Firebase token",
                },
            });
            return;
        }

        const email = tokenEmail || bodyEmail;
        const name = bodyName || firebaseUser?.name;
        const image = bodyImage || firebaseUser?.picture;

        if (!authStudentId || !email || !name) {
            res.status(400).json({
                data: {
                    success: false,
                    message: "Missing required fields: authStudentId, email, name",
                },
            });
            return;
        }

        // Check if user already exists by ID
        const existingUserById = await db.query.user.findFirst({
            where: eq(user.id, authStudentId),
        });

        if (existingUserById) {
            // User already exists, optionally update their info
            await db
                .update(user)
                .set({
                    name: name,
                    image: image || existingUserById.image,
                    fcmToken: fcmToken || existingUserById.fcmToken,
                    updatedAt: new Date(),
                })
                .where(eq(user.id, authStudentId));

            res.json({
                data: {
                    success: true,
                    message: "User already exists, info updated",
                    user: { id: authStudentId, email, name, role: existingUserById.role },
                },
            });
            return;
        }

        // Check if email is already used by another user
        const existingUserByEmail = await db.query.user.findFirst({
            where: eq(user.email, email),
        });

        if (existingUserByEmail) {
            // Email exists with different ID - link the accounts
            // Return the existing web user's ID so the app uses it for API calls
            await db
                .update(user)
                .set({
                    name: name,
                    image: image || existingUserByEmail.image,
                    fcmToken: fcmToken || existingUserByEmail.fcmToken,
                    updatedAt: new Date(),
                })
                .where(eq(user.id, existingUserByEmail.id));

            res.json({
                data: {
                    success: true,
                    message: "Account linked with existing web user",
                    user: {
                        id: existingUserByEmail.id,  // Return web user's ID!
                        email,
                        name,
                        role: existingUserByEmail.role
                    },
                    linkedFrom: "firebase",
                    firebaseUid: authStudentId
                },
            });
            return;
        }

        // Create new user
        const [newUser] = await db
            .insert(user)
            .values({
                id: authStudentId,
                name: name,
                email: email,
                emailVerified: firebaseUser?.email_verified ?? true,
                image: image,
                role: "student",
                fcmToken: fcmToken,
            })
            .returning();

        res.status(201).json({
            data: {
                success: true,
                message: "User created successfully",
                user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
            },
        });
    } catch (error) {
        console.error("Error syncing user:", error);
        res.status(500).json({
            data: {
                success: false,
                message: "Failed to sync user",
                error: error instanceof Error ? error.message : "Unknown error",
            },
        });
    }
});

/**
 * Clear FCM token on logout to prevent duplicate notifications
 * This endpoint removes the FCM token from the user's record
 * Uses Firebase Auth middleware to verify the user's identity
 */
router.post("/clear-fcm-token", requireFirebaseAuth, async (req, res) => {
    try {
        const firebaseUser = (req as any).firebaseUser as {
            uid?: string;
            email?: string;
        };

        // Get user ID from verified Firebase token
        const firebaseUid = firebaseUser?.uid;
        if (!firebaseUid) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid Firebase token",
            });
            return;
        }

        // Find the user by Firebase UID or by email (for linked accounts)
        let dbUser = await db.query.user.findFirst({
            where: eq(user.id, firebaseUid),
        });

        // If not found by UID, try finding by email (for web-linked accounts)
        if (!dbUser && firebaseUser.email) {
            dbUser = await db.query.user.findFirst({
                where: eq(user.email, firebaseUser.email),
            });
        }

        if (!dbUser) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // Clear FCM token for the user
        await db
            .update(user)
            .set({
                fcmToken: null,
                updatedAt: new Date(),
            })
            .where(eq(user.id, dbUser.id));

        res.json({
            success: true,
            message: "FCM token cleared successfully",
        });
    } catch (error) {
        console.error("Error clearing FCM token:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear FCM token",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

/**
 * Update FCM token for a user (used when token refreshes)
 * Uses Firebase Auth middleware to verify the user's identity
 */
router.post("/update-fcm-token", requireFirebaseAuth, async (req, res) => {
    try {
        const firebaseUser = (req as any).firebaseUser as {
            uid?: string;
            email?: string;
        };

        const { fcmToken } = req.body;

        if (!fcmToken) {
            res.status(400).json({
                success: false,
                message: "FCM token is required",
            });
            return;
        }

        // Get user ID from verified Firebase token
        const firebaseUid = firebaseUser?.uid;
        if (!firebaseUid) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid Firebase token",
            });
            return;
        }

        // Find the user by Firebase UID or by email (for linked accounts)
        let dbUser = await db.query.user.findFirst({
            where: eq(user.id, firebaseUid),
        });

        // If not found by UID, try finding by email (for web-linked accounts)
        if (!dbUser && firebaseUser.email) {
            dbUser = await db.query.user.findFirst({
                where: eq(user.email, firebaseUser.email),
            });
        }

        if (!dbUser) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // Update FCM token for the user
        await db
            .update(user)
            .set({
                fcmToken: fcmToken,
                updatedAt: new Date(),
            })
            .where(eq(user.id, dbUser.id));

        res.json({
            success: true,
            message: "FCM token updated successfully",
        });
    } catch (error) {
        console.error("Error updating FCM token:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update FCM token",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

export default router;
