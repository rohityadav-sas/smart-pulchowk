import admin from "firebase-admin";
import ENV from "../config/ENV.js";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";
import {
  createInAppNotificationForAudience,
  createInAppNotificationForUser,
} from "./inAppNotification.service.js";
import { normalizeNotificationPreferences } from "../lib/notification-preferences.js";

let isFirebaseInitialized = false;

function initializeFirebase() {
  try {
    if (admin.apps.length > 0) {
      isFirebaseInitialized = true;
      return;
    }

    let serviceAccount: any;

    if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
      console.log("Firebase initializing from environment variable.");
    }

    if (!serviceAccount) {
      console.warn(
        "No Firebase credentials found in FIREBASE_SERVICE_ACCOUNT_JSON. Automated notifications disabled.",
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    isFirebaseInitialized = true;
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
  }
}

// Initialize on load
initializeFirebase();

interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

function isTypeAllowedByPreferences(
  type: string,
  preferences: ReturnType<typeof normalizeNotificationPreferences>,
  iconKey?: string,
) {
  const lower = type.toLowerCase();
  const icon = (iconKey || "").toLowerCase();

  const isEventType = lower.startsWith("event_") || lower === "new_event";
  const isNoticeType = lower.startsWith("notice_");
  const isMarketplaceType =
    lower === "book_listed" ||
    lower === "new_book" ||
    lower === "purchase_request" ||
    lower === "request_response" ||
    lower === "purchase_request_cancelled" ||
    lower === "purchase_request_removed" ||
    icon === "book";
  const isClassroomType =
    lower === "new_assignment" ||
    lower === "grading_update" ||
    lower === "assignment_deadline" ||
    icon === "classroom";
  const isChatType = lower === "chat_message" || lower === "chat_mention";
  const isAdminType =
    lower.startsWith("admin_") ||
    lower === "role_changed" ||
    lower === "security_alert" ||
    lower === "system_announcement";
  const isLostFoundType =
    lower.startsWith("lost_") ||
    lower.startsWith("found_") ||
    lower.startsWith("lostfound_") ||
    icon === "search";

  if (isEventType && !preferences.eventReminders) return false;
  if (isNoticeType && !preferences.noticeUpdates) return false;
  if (isMarketplaceType && !preferences.marketplaceAlerts) return false;
  if (isClassroomType && !preferences.classroomAlerts) return false;
  if (isChatType && !preferences.chatAlerts) return false;
  if (isAdminType && !preferences.adminAlerts) return false;
  if (isLostFoundType && !preferences.lostAndFoundAlerts) return false;
  return true;
}

export const sendToTopic = async (
  topic: string,
  payload: NotificationPayload,
) => {
  const derivedTitle =
    payload.title || (typeof payload.data?.title === "string" ? payload.data.title : undefined);
  const derivedBody =
    payload.body || (typeof payload.data?.body === "string" ? payload.data.body : undefined);

  if (derivedTitle && derivedBody) {
    if (topic === "events") {
      createInAppNotificationForAudience({
        audience: "all",
        type: "event_published",
        title: derivedTitle,
        body: derivedBody,
        data: { iconKey: "event", ...payload.data },
      }).catch((error) =>
        console.error("Failed to create in-app audience notification:", error),
      );
    }

    if (topic === "books") {
      createInAppNotificationForAudience({
        audience: "all",
        type: "book_listed",
        title: derivedTitle,
        body: derivedBody,
        data: { iconKey: "book", ...payload.data },
      }).catch((error) =>
        console.error("Failed to create in-app audience notification:", error),
      );
    }

    if (topic === "lost_found") {
      createInAppNotificationForAudience({
        audience: "all",
        type: "lost_found_published",
        title: derivedTitle,
        body: derivedBody,
        data: { iconKey: "search", ...payload.data },
      }).catch((error) =>
        console.error("Failed to create in-app audience notification:", error),
      );
    }
  }

  if (!isFirebaseInitialized) {
    console.warn("Cannot send notification: Firebase not initialized.");
    return;
  }

  const message: any = {
    data: {
      ...payload.data,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    topic: topic,
  };

  if (payload.title && payload.body) {
    message.notification = {
      title: payload.title,
      body: payload.body,
    };
  } else {
    // If it's a data-only message, ensure title and body are in data
    // so the client can display them manually if needed
    if (payload.title) message.data.title = payload.title;
    if (payload.body) message.data.body = payload.body;
  }

  try {
    const response = await admin.messaging().send(message);
    console.log(`Successfully sent notification to topic ${topic}:`, response);
    return response;
  } catch (error) {
    console.error(`Error sending notification to topic ${topic}:`, error);
  }
};

export const sendToUser = async (
  userId: string,
  payload: NotificationPayload,
) => {
  try {
    const notificationType = payload.data?.type || "user_notification";

    // Fetch user's FCM token from DB
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { fcmToken: true, notificationPreferences: true },
    });

    const preferences = normalizeNotificationPreferences(
      userData?.notificationPreferences,
    );

    if (
      !isTypeAllowedByPreferences(
        notificationType,
        preferences,
        payload.data?.iconKey,
      )
    ) {
      return;
    }

    if (payload.title && payload.body) {
      createInAppNotificationForUser({
        userId,
        type: notificationType,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }).catch((error) =>
        console.error("Failed to create in-app user notification:", error),
      );
    }

    if (!isFirebaseInitialized) {
      console.warn("Cannot send notification: Firebase not initialized.");
      return;
    }

    if (!userData?.fcmToken) {
      console.warn(
        `Cannot send notification: No FCM token found for user ${userId}`,
      );
      return;
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...payload.data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
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
  const creatorId =
    typeof event?.creatorId === "string" && event.creatorId.trim().length > 0
      ? event.creatorId
      : undefined;
  return sendToTopic("events", {
    title: "New Event Published!",
    body: `${event.title} is now open for registration.`,
    data: {
      eventId: event.id.toString(),
      eventTitle: String(event.title),
      type: "new_event",
      iconKey: "event",
      ...(creatorId ? { publisherId: creatorId } : {}),
      ...(event.bannerUrl ? { bannerUrl: String(event.bannerUrl), thumbnailUrl: String(event.bannerUrl) } : {}),
    },
  });
};
