import admin from 'firebase-admin'
import ENV from '../config/ENV.js'
import { db } from '../lib/db.js'
import { user } from '../models/auth-schema.js'
import { eq, and, sql, notInArray } from 'drizzle-orm'
import {
  createInAppNotificationForAudience,
  createInAppNotificationForUser,
} from './inAppNotification.service.js'
import { normalizeNotificationPreferences } from '../lib/notification-preferences.js'

let isFirebaseInitialized = false

function initializeFirebase() {
  try {
    if (admin.apps.length > 0) {
      isFirebaseInitialized = true
      return
    }

    let serviceAccount: any

    if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON)
      console.log('Firebase initializing from environment variable.')
    }

    if (!serviceAccount) {
      console.warn(
        'No Firebase credentials found in FIREBASE_SERVICE_ACCOUNT_JSON. Automated notifications disabled.',
      )
      return
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })

    isFirebaseInitialized = true
    console.log('Firebase Admin SDK initialized successfully.')
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error)
  }
}

// Initialize on load
initializeFirebase()

interface NotificationPayload {
  title?: string
  body?: string
  data?: Record<string, string>
}

function isTypeAllowedByPreferences(
  type: string,
  preferences: ReturnType<typeof normalizeNotificationPreferences>,
  iconKey?: string,
) {
  const lower = type.toLowerCase()
  const icon = (iconKey || '').toLowerCase()

  const isEventType = lower.startsWith('event_') || lower === 'new_event'
  const isNoticeType = lower.startsWith('notice_')
  const isMarketplaceType =
    lower === 'book_listed' ||
    lower === 'new_book' ||
    lower === 'purchase_request' ||
    lower === 'request_response' ||
    lower === 'purchase_request_cancelled' ||
    lower === 'purchase_request_removed' ||
    icon === 'book'
  const isClassroomType =
    lower === 'new_assignment' ||
    lower === 'grading_update' ||
    lower === 'assignment_deadline' ||
    icon === 'classroom'
  const isChatType = lower === 'chat_message' || lower === 'chat_mention'
  const isAdminType =
    lower.startsWith('admin_') ||
    lower === 'role_changed' ||
    lower === 'security_alert' ||
    lower === 'system_announcement'
  const isLostFoundType =
    lower.startsWith('lost_') ||
    lower.startsWith('found_') ||
    lower.startsWith('lostfound_') ||
    icon === 'search'

  if (isEventType && !preferences.eventReminders) {
    console.log(`Notification of type ${type} BLOCKED by eventReminders`);
    return false
  }
  if (isNoticeType && !preferences.noticeUpdates) {
    console.log(`Notification of type ${type} BLOCKED by noticeUpdates`);
    return false
  }
  if (isMarketplaceType && !preferences.marketplaceAlerts) {
    console.log(`Notification of type ${type} BLOCKED by marketplaceAlerts`);
    return false
  }
  if (isClassroomType && !preferences.classroomAlerts) {
    console.log(`Notification of type ${type} BLOCKED by classroomAlerts`);
    return false
  }
  if (isChatType && !preferences.chatAlerts) {
    console.log(`Notification of type ${type} BLOCKED by chatAlerts`);
    return false
  }
  if (isAdminType && !preferences.adminAlerts) {
    console.log(`Notification of type ${type} BLOCKED by adminAlerts`);
    return false
  }
  if (isLostFoundType && !preferences.lostAndFoundAlerts) {
    console.log(`Notification of type ${type} BLOCKED by lostAndFoundAlerts`);
    return false
  }
  return true
}

export const sendToTopic = async (
  topic: string,
  payload: NotificationPayload,
) => {
  const sideEffects: Promise<unknown>[] = []
  const derivedTitle =
    payload.title ||
    (typeof payload.data?.title === 'string' ? payload.data.title : undefined)
  const derivedBody =
    payload.body ||
    (typeof payload.data?.body === 'string' ? payload.data.body : undefined)

  if (derivedTitle && derivedBody) {
    if (topic === 'events') {
      sideEffects.push(
        createInAppNotificationForAudience({
          audience: 'all',
          type: 'event_published',
          title: derivedTitle,
          body: derivedBody,
          data: { iconKey: 'event', ...payload.data },
        }).catch((error) =>
          console.error(
            'Failed to create in-app audience notification:',
            error,
          ),
        ),
      )
    }

    if (topic === 'books') {
      sideEffects.push(
        createInAppNotificationForAudience({
          audience: 'all',
          type: 'book_listed',
          title: derivedTitle,
          body: derivedBody,
          data: { iconKey: 'book', ...payload.data },
        }).catch((error) =>
          console.error(
            'Failed to create in-app audience notification:',
            error,
          ),
        ),
      )
    }

    if (topic === 'lost_found') {
      sideEffects.push(
        createInAppNotificationForAudience({
          audience: 'all',
          type: 'lost_found_published',
          title: derivedTitle,
          body: derivedBody,
          data: { iconKey: 'lost_found', ...payload.data },
        }).catch((error) =>
          console.error(
            'Failed to create in-app audience notification:',
            error,
          ),
        ),
      )
    }

    if (topic === 'admins') {
      sideEffects.push(
        createInAppNotificationForAudience({
          audience: 'admins',
          type: payload.data?.type || 'admin_alert',
          title: derivedTitle,
          body: derivedBody,
          data: { iconKey: 'admin', ...payload.data },
        }).catch((error) =>
          console.error(
            'Failed to create in-app audience notification:',
            error,
          ),
        ),
      )
    }
  }

  if (!isFirebaseInitialized) {
    console.warn('Cannot send notification: Firebase not initialized.')
    await Promise.all(sideEffects)
    return
  }

  const message: any = {
    data: {
      ...payload.data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    topic: topic,
  }

  if (payload.title && payload.body) {
    message.notification = {
      title: payload.title,
      body: payload.body,
    }
  } else {
    // If it's a data-only message, ensure title and body are in data
    // so the client can display them manually if needed
    if (payload.title) message.data.title = payload.title
    if (payload.body) message.data.body = payload.body
  }

  try {
    const response = await admin.messaging().send(message)
    console.log(`Successfully sent notification to topic ${topic}:`, response)
    await Promise.all(sideEffects)
    return response
  } catch (error) {
    await Promise.all(sideEffects)
    console.error(`Error sending notification to topic ${topic}:`, error)
  }
}

export const sendToTopicFiltered = async (
  topic: string,
  payload: NotificationPayload,
  options: {
    excludeUserIds?: string[]
    excludeRoles?: string[]
  },
) => {
  const sideEffects: Promise<unknown>[] = []
  const derivedTitle =
    payload.title ||
    (typeof payload.data?.title === 'string' ? payload.data.title : undefined)
  const derivedBody =
    payload.body ||
    (typeof payload.data?.body === 'string' ? payload.data.body : undefined)

  if (derivedTitle && derivedBody && topic === 'books') {
    sideEffects.push(
      createInAppNotificationForAudience({
        audience: 'all',
        type: 'book_listed',
        title: derivedTitle,
        body: derivedBody,
        data: { iconKey: 'book', ...payload.data },
      }).catch((error) =>
        console.error('Failed to create in-app audience notification:', error),
      ),
    )
  }

  // If no exclusions, fallback to standard topic send
  if (!options.excludeUserIds?.length && !options.excludeRoles?.length) {
    return sendToTopic(topic, payload)
  }

  if (!isFirebaseInitialized) {
    console.warn('Cannot send notification: Firebase not initialized.')
    await Promise.all(sideEffects)
    return
  }

  try {
    // Fetch users with FCM tokens and filter them
    const recipients = await db.query.user.findMany({
      where: and(
        sql`${user.fcmToken} is not null`,
        options.excludeUserIds?.length
          ? notInArray(user.id, options.excludeUserIds)
          : undefined,
        options.excludeRoles?.length
          ? notInArray(user.role, options.excludeRoles)
          : undefined,
      ),
      columns: { fcmToken: true },
    })

    const tokens = recipients
      .map((r) => r.fcmToken)
      .filter((t): t is string => !!t)

    if (tokens.length === 0) {
      await Promise.all(sideEffects)
      return
    }

    // Multicast sends to unique tokens
    const uniqueTokens = [...new Set(tokens)]

    // Firebase multicast limit is 500 tokens per call
    const chunks = []
    for (let i = 0; i < uniqueTokens.length; i += 500) {
      chunks.push(uniqueTokens.slice(i, i + 500))
    }

    const message: any = {
      data: {
        ...payload.data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    }

    if (payload.title && payload.body) {
      message.notification = {
        title: payload.title,
        body: payload.body,
      }
    } else {
      if (payload.title) message.data.title = payload.title
      if (payload.body) message.data.body = payload.body
    }

    const responses = await Promise.all(
      chunks.map((chunk) =>
        admin.messaging().sendEachForMulticast({
          ...message,
          tokens: chunk,
        }),
      ),
    )

    console.log(
      `Successfully sent filtered multicast for topic ${topic} to ${uniqueTokens.length} devices.`,
    )
    await Promise.all(sideEffects)
    return responses
  } catch (error) {
    await Promise.all(sideEffects)
    console.error(`Error sending filtered notifications for topic ${topic}:`, error)
  }
}

export const sendToUser = async (
  userId: string,
  payload: NotificationPayload,
) => {
  const sideEffects: Promise<unknown>[] = []
  try {
    const notificationType = payload.data?.type || 'user_notification'

    // Fetch user's FCM token from DB
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { fcmToken: true, notificationPreferences: true },
    })

    const preferences = normalizeNotificationPreferences(
      userData?.notificationPreferences,
    )

    if (
      !isTypeAllowedByPreferences(
        notificationType,
        preferences,
        payload.data?.iconKey,
      )
    ) {
      console.log(
        `Push notification for user ${userId} of type ${notificationType} BLOCKED by user preferences.`,
      )
      return
    }

    if (payload.title && payload.body) {
      sideEffects.push(
        createInAppNotificationForUser({
          userId,
          type: notificationType,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        }).catch((error) =>
          console.error('Failed to create in-app user notification:', error),
        ),
      )
    }

    if (!isFirebaseInitialized) {
      console.warn('Cannot send notification: Firebase not initialized.')
      await Promise.all(sideEffects)
      return
    }

    if (!userData?.fcmToken) {
      console.warn(
        `Cannot send push notification: No FCM token found for user ${userId}. (In-app notification created)`,
      )
      await Promise.all(sideEffects)
      return
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
    }

    console.log(
      `Attempting to send FCM push to user ${userId} (Token length: ${userData.fcmToken.length})`,
    )
    const response = await admin.messaging().send(message)
    console.log(`FCM push SUCCESS for user ${userId}:`, response)
    await Promise.all(sideEffects)
    return response
  } catch (error) {
    // We can't wait for sideEffects here easily as they are scoped in 'try' if defined inside but here they are top level of try?
    // Wait, sideEffects should be defined outside try block or available?
    // In my chunk 4, I defined it inside try? No, 'try' starts at 187.
    // I need to correct chunk 4 to define 'sideEffects' outside 'try' or await it?
    // Wait, 'sendToUser' wrapping.
    console.error(`Error sending notification to user ${userId}:`, error)
  }
}

/**
 * @deprecated Use sendToTopic or sendToUser instead
 */
export const sendEventNotification = async (event: any) => {
  const creatorId =
    typeof event?.creatorId === 'string' && event.creatorId.trim().length > 0
      ? event.creatorId
      : undefined
  return sendToTopic('events', {
    title: 'New Event Published!',
    body: `${event.title} is now open for registration.`,
    data: {
      eventId: event.id.toString(),
      eventTitle: String(event.title),
      type: 'new_event',
      iconKey: 'event',
      ...(creatorId ? { publisherId: creatorId } : {}),
      ...(event.bannerUrl
        ? {
            bannerUrl: String(event.bannerUrl),
            thumbnailUrl: String(event.bannerUrl),
          }
        : {}),
    },
  })
}
