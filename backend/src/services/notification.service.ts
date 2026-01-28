import admin from 'firebase-admin';
import ENV from '../config/ENV.js';
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

export const sendEventNotification = async (event: any) => {
    if (!isFirebaseInitialized) {
        console.warn('Cannot send notification: Firebase not initialized.');
        return;
    }

    const topic = 'events';

    const message = {
        notification: {
            title: 'New Event Published!',
            body: `${event.title} is now open for registration.`,
        },
        data: {
            eventId: event.id.toString(),
            type: 'new_event',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        topic: topic,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
        return response;
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};
