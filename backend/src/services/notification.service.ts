import admin from 'firebase-admin';
import ENV from '../config/ENV.js';
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

let isFirebaseInitialized = false;

function initializeFirebase() {
    try {
        let serviceAccount: any;

        if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
            serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
            console.log('Firebase initializing from environment variable.');
        } else if (ENV.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const keyPath = ENV.FIREBASE_SERVICE_ACCOUNT_PATH;
            const absolutePath = path.isAbsolute(keyPath)
                ? keyPath
                : path.join(process.cwd(), keyPath);

            if (fs.existsSync(absolutePath)) {
                serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
                console.log(`Firebase initializing from file: ${absolutePath}`);
            }
        }

        if (!serviceAccount) {
            console.warn('No Firebase credentials found (JSON or Path). Automated notifications disabled.');
            return;
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        isFirebaseInitialized = true;
        console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error);
    }
}

// Initialize on load
initializeFirebase();

interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

export const sendToTopic = async (topic: string, payload: NotificationPayload) => {
    if (!isFirebaseInitialized) {
        console.warn('Cannot send notification: Firebase not initialized.');
        return;
    }

    const message = {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
            ...payload.data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        topic: topic,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`Successfully sent notification to topic ${topic}:`, response);
        return response;
    } catch (error) {
        console.error(`Error sending notification to topic ${topic}:`, error);
    }
};

export const sendToUser = async (userId: string, payload: NotificationPayload) => {
    if (!isFirebaseInitialized) {
        console.warn('Cannot send notification: Firebase not initialized.');
        return;
    }

    try {
        // Fetch user's FCM token from DB
        const userData = await db.query.user.findFirst({
            where: eq(user.id, userId),
            columns: { fcmToken: true }
        });

        if (!userData?.fcmToken) {
            console.warn(`Cannot send notification: No FCM token found for user ${userId}`);
            return;
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                ...payload.data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            token: userData.fcmToken,
        };

        const response = await admin.messaging().send(message);
        console.log(`Successfully sent notification to user ${userId}:`, response);
        return response;
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
    }
};

/**
 * @deprecated Use sendToTopic or sendToUser instead
 */
export const sendEventNotification = async (event: any) => {
    return sendToTopic('events', {
        title: 'New Event Published!',
        body: `${event.title} is now open for registration.`,
        data: {
            eventId: event.id.toString(),
            type: 'new_event',
        }
    });
};
