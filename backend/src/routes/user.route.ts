import express from "express";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";

const router = express.Router();

/**
 * Sync Firebase user to Postgres database
 * This allows Firebase Auth users from the mobile app to be registered in the same database
 * as Better Auth users from the website
 */
router.post("/sync-user", async (req, res) => {
    try {
        const { authStudentId, email, name, image, fcmToken } = req.body;

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
                emailVerified: true, // Firebase verifies emails
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

export default router;
