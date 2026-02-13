import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  notificationReads,
  notifications,
  type notificationAudienceEnum,
} from "../models/notification-schema.js";
import { clubs, events } from "../models/event-schema.js";
import { notice } from "../models/notice-schema.js";
import {
  bookImages,
  bookListings,
  bookPurchaseRequests,
} from "../models/book_buy_sell-schema.js";
import { lostFoundClaims, lostFoundImages, lostFoundItems } from "../models/lost-found-schema.js";
import { user } from "../models/auth-schema.js";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeNotificationPreferences,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from "../lib/notification-preferences.js";

type Audience = (typeof notificationAudienceEnum.enumValues)[number];
type UserRole = "student" | "teacher" | "admin" | "notice_manager" | string;
type NotificationData = Record<string, string | number | boolean | null>;

function parseNumericId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

function inferIconKey(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("chat")) return "chat";
  if (lower.includes("event")) return "event";
  if (
    lower.includes("book") ||
    lower.includes("purchase") ||
    lower.includes("request") ||
    lower.includes("lost_found")
  ) {
    return lower.includes("lost_found") ? "lost_found" : "book";
  }
  if (lower.includes("notice")) return "notice";
  if (lower.includes("assignment") || lower.includes("grading")) return "classroom";
  return "general";
}

async function enrichNotificationData(rows: Array<{ type: string; data: unknown }>) {
  const eventIds = new Set<number>();
  const noticeIds = new Set<number>();
  const listingIds = new Set<number>();
  const requestIds = new Set<number>();
  const claimIds = new Set<number>();
  const itemIds = new Set<number>();
  const actorUserIds = new Set<string>();

  for (const row of rows) {
    const data = (row.data || {}) as NotificationData;
    const eventId = parseNumericId(data.eventId);
    const noticeId = parseNumericId(data.noticeId);
    const listingId = parseNumericId(data.listingId) ?? parseNumericId(data.bookId);
    const requestId = parseNumericId(data.requestId);
    const claimId = parseNumericId(data.claimId);
    const itemId = parseNumericId(data.itemId);
    const actorIdCandidate = [
      parseString(data.actorId),
      parseString(data.senderId),
      parseString(data.buyerId),
      parseString(data.publisherId),
      parseString(data.sellerId),
      parseString(data.teacherId),
      parseString(data.creatorId),
      parseString(data.authorId),
      parseString(data.userId),
    ].find((value) => !!value);

    if (eventId) eventIds.add(eventId);
    if (noticeId) noticeIds.add(noticeId);
    if (listingId) listingIds.add(listingId);
    if (requestId) requestIds.add(requestId);
    if (claimId) claimIds.add(claimId);
    if (itemId) itemIds.add(itemId);
    if (actorIdCandidate) actorUserIds.add(actorIdCandidate);
  }

  const [
    eventRows,
    noticeRows,
    listingImageRows,
    requestRows,
    claimRows,
    actorRows,
    lostFoundImageRows,
  ] = await Promise.all([
    eventIds.size > 0
      ? db
          .select({ id: events.id, bannerUrl: events.bannerUrl, title: events.title })
          .from(events)
          .where(inArray(events.id, [...eventIds]))
      : Promise.resolve([]),
    noticeIds.size > 0
      ? db
          .select({
            id: notice.id,
            attachmentUrl: notice.attachmentUrl,
            title: notice.title,
          })
          .from(notice)
          .where(inArray(notice.id, [...noticeIds]))
      : Promise.resolve([]),
    listingIds.size > 0
      ? db
          .select({
            id: bookListings.id,
            imageUrl: bookImages.imageUrl,
            title: bookListings.title,
          })
          .from(bookListings)
          .leftJoin(bookImages, eq(bookImages.listingId, bookListings.id))
          .where(inArray(bookListings.id, [...listingIds]))
      : Promise.resolve([]),
    requestIds.size > 0
      ? db
          .select({
            id: bookPurchaseRequests.id,
            listingId: bookPurchaseRequests.listingId,
            buyerId: bookPurchaseRequests.buyerId,
            buyerName: user.name,
            buyerImage: user.image,
            listingTitle: bookListings.title,
          })
          .from(bookPurchaseRequests)
          .innerJoin(user, eq(user.id, bookPurchaseRequests.buyerId))
          .innerJoin(bookListings, eq(bookListings.id, bookPurchaseRequests.listingId))
          .where(inArray(bookPurchaseRequests.id, [...requestIds]))
      : Promise.resolve([]),
    claimIds.size > 0
      ? db
          .select({
            id: lostFoundClaims.id,
            requesterId: lostFoundClaims.requesterId,
            requesterName: user.name,
            requesterImage: user.image,
            itemType: lostFoundItems.itemType,
            itemTitle: lostFoundItems.title,
          })
          .from(lostFoundClaims)
          .innerJoin(user, eq(user.id, lostFoundClaims.requesterId))
          .innerJoin(lostFoundItems, eq(lostFoundItems.id, lostFoundClaims.itemId))
          .where(inArray(lostFoundClaims.id, [...claimIds]))
      : Promise.resolve([]),
    actorUserIds.size > 0
      ? db
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
          })
          .from(user)
          .where(inArray(user.id, [...actorUserIds]))
      : Promise.resolve([]),
    itemIds.size > 0
      ? db
          .select({
            itemId: lostFoundImages.itemId,
            imageUrl: lostFoundImages.imageUrl,
          })
          .from(lostFoundImages)
          .where(inArray(lostFoundImages.itemId, [...itemIds]))
          .orderBy(lostFoundImages.sortOrder)
      : Promise.resolve([]),
  ]);

  const eventMap = new Map<number, { bannerUrl: string | null; title: string | null }>(
    eventRows.map((row) => [
      row.id,
      {
        bannerUrl: row.bannerUrl ?? null,
        title: row.title ?? null,
      },
    ]),
  );
  const noticeMap = new Map<number, { attachmentUrl: string | null; title: string | null }>(
    noticeRows.map((row) => [
      row.id,
      {
        attachmentUrl: row.attachmentUrl ?? null,
        title: row.title ?? null,
      },
    ]),
  );
  const listingMap = new Map<number, { imageUrl: string | null; title: string | null }>();
  for (const row of listingImageRows) {
    if (!listingMap.has(row.id)) {
      listingMap.set(row.id, { imageUrl: row.imageUrl ?? null, title: row.title ?? null });
    }
  }
  const requestMap = new Map<
    number,
    {
      listingId: number;
      buyerId: string;
      buyerName: string | null;
      buyerImage: string | null;
      listingTitle: string | null;
    }
  >(
    requestRows.map((row) => [
      row.id,
      {
        listingId: row.listingId,
        buyerId: row.buyerId,
        buyerName: row.buyerName ?? null,
        buyerImage: row.buyerImage ?? null,
        listingTitle: row.listingTitle ?? null,
      },
    ]),
  );
  const claimMap = new Map<
    number,
    {
      requesterId: string;
      requesterName: string | null;
      requesterImage: string | null;
      itemType: "lost" | "found";
      itemTitle: string | null;
    }
  >(
    claimRows.map((row) => [
      row.id,
      {
        requesterId: row.requesterId,
        requesterName: row.requesterName ?? null,
        requesterImage: row.requesterImage ?? null,
        itemType: row.itemType,
        itemTitle: row.itemTitle ?? null,
      },
    ]),
  );
  const actorMap = new Map<string, { name: string | null; image: string | null }>(
    actorRows.map((row) => [
      row.id,
      {
        name: row.name ?? null,
        image: row.image ?? null,
      },
    ]),
  );
  const itemImageMap = new Map<number, string>();
  for (const row of lostFoundImageRows) {
    if (!itemImageMap.has(row.itemId)) {
      itemImageMap.set(row.itemId, row.imageUrl);
    }
  }

  return rows.map((row) => {
    const sourceData = (row.data || {}) as NotificationData;
    const data: NotificationData = { ...sourceData };
    const existingThumb =
      parseString(data.thumbnailUrl) ??
      parseString(data.bannerUrl) ??
      parseString(data.attachmentUrl) ??
      parseString(data.imageUrl);

    if (!existingThumb) {
      const eventId = parseNumericId(data.eventId);
      const noticeId = parseNumericId(data.noticeId);
      const listingId = parseNumericId(data.listingId) ?? parseNumericId(data.bookId);
      const itemId = parseNumericId(data.itemId);

      const eventMeta = eventId ? eventMap.get(eventId) : null;
      const noticeMeta = noticeId ? noticeMap.get(noticeId) : null;
      const listingMeta = listingId ? listingMap.get(listingId) : null;
      const itemImage = itemId ? itemImageMap.get(itemId) : null;

      if (eventMeta?.bannerUrl) data.thumbnailUrl = eventMeta.bannerUrl;
      else if (noticeMeta?.attachmentUrl && isImageUrl(noticeMeta.attachmentUrl))
        data.thumbnailUrl = noticeMeta.attachmentUrl;
      else if (listingMeta?.imageUrl) data.thumbnailUrl = listingMeta.imageUrl;
      else if (itemImage) data.thumbnailUrl = itemImage;
    }

    const eventId = parseNumericId(data.eventId);
    const noticeId = parseNumericId(data.noticeId);
    const listingId = parseNumericId(data.listingId) ?? parseNumericId(data.bookId);
    const eventMeta = eventId ? eventMap.get(eventId) : null;
    const noticeMeta = noticeId ? noticeMap.get(noticeId) : null;
    const listingMeta = listingId ? listingMap.get(listingId) : null;
    if (!parseString(data.eventTitle) && eventMeta?.title) {
      data.eventTitle = eventMeta.title;
    }
    if (!parseString(data.noticeTitle) && noticeMeta?.title) {
      data.noticeTitle = noticeMeta.title;
    }
    if (!parseString(data.listingTitle) && listingMeta?.title) {
      data.listingTitle = listingMeta.title;
    }

    const requestId = parseNumericId(data.requestId);
    const requestMeta = requestId ? requestMap.get(requestId) : null;
    if (requestMeta) {
      if (!parseNumericId(data.listingId) && !parseNumericId(data.bookId)) {
        data.listingId = requestMeta.listingId;
      }
      if (!parseString(data.buyerId)) {
        data.buyerId = requestMeta.buyerId;
      }
      if (!parseString(data.buyerName) && requestMeta.buyerName) {
        data.buyerName = requestMeta.buyerName;
      }
      if (!parseString(data.actorName) && requestMeta.buyerName) {
        data.actorName = requestMeta.buyerName;
      }
      if (!parseString(data.actorAvatarUrl) && requestMeta.buyerImage) {
        data.actorAvatarUrl = requestMeta.buyerImage;
      }
      if (!parseString(data.listingTitle) && requestMeta.listingTitle) {
        data.listingTitle = requestMeta.listingTitle;
      }
    }

    const claimId = parseNumericId(data.claimId);
    const claimMeta = claimId ? claimMap.get(claimId) : null;
    if (claimMeta && row.type === "lost_found_claim_received") {
      if (!parseString(data.actorId)) {
        data.actorId = claimMeta.requesterId;
      }
      if (!parseString(data.actorName) && claimMeta.requesterName) {
        data.actorName = claimMeta.requesterName;
      }
      if (!parseString(data.actorAvatarUrl) && claimMeta.requesterImage) {
        data.actorAvatarUrl = claimMeta.requesterImage;
      }
      if (!parseString(data.requesterName) && claimMeta.requesterName) {
        data.requesterName = claimMeta.requesterName;
      }
      if (!parseString(data.requesterAvatarUrl) && claimMeta.requesterImage) {
        data.requesterAvatarUrl = claimMeta.requesterImage;
      }
      if (!parseString(data.itemType)) {
        data.itemType = claimMeta.itemType;
      }
      if (!parseString(data.itemTitle) && claimMeta.itemTitle) {
        data.itemTitle = claimMeta.itemTitle;
      }

      // Populate item image for claim received notifications if missing
      const itemId = parseNumericId(data.itemId);
      const itemImage = itemId ? itemImageMap.get(itemId) : null;
      if (!parseString(data.thumbnailUrl) && itemImage) {
        data.thumbnailUrl = itemImage;
      }
    }

    const actorIdCandidate = [
      parseString(data.actorId),
      parseString(data.senderId),
      parseString(data.buyerId),
      parseString(data.publisherId),
      parseString(data.sellerId),
      parseString(data.teacherId),
      parseString(data.creatorId),
      parseString(data.authorId),
      parseString(data.userId),
    ].find((value) => !!value);
    if (actorIdCandidate) {
      const actorMeta = actorMap.get(actorIdCandidate);
      if (actorMeta) {
        if (!parseString(data.actorName) && actorMeta.name) {
          data.actorName = actorMeta.name;
        }
        if (!parseString(data.actorAvatarUrl) && actorMeta.image) {
          data.actorAvatarUrl = actorMeta.image;
        }
      }
    }

    if (!parseString(data.iconKey)) {
      data.iconKey = inferIconKey(row.type);
    }

    return data;
  });
}

function getVisibleAudiencesForRole(role?: UserRole): Audience[] {
  const audiences: Audience[] = ["all"];

  if (role === "teacher") audiences.push("teachers");
  else if (role === "admin") audiences.push("admins");
  else if (role !== "notice_manager") audiences.push("students");

  return audiences;
}

function getRoleTypeFilter(role?: UserRole): SQL | null {
  if (role === "notice_manager") {
    return sql`(
      ${notifications.type} like 'notice_%'
      or ${notifications.type} like 'admin_%'
      or ${notifications.type} = 'system_announcement'
    )`;
  }
  if (role === "admin") {
    // Keep admin feeds focused on moderation/system updates.
    return sql`(
      ${notifications.type} like 'notice_%'
      or ${notifications.type} like 'admin_%'
      or ${notifications.type} in ('system_announcement', 'role_changed', 'security_alert')
    )`;
  }
  return null;
}

function isNotificationTypeAllowedByPreferences(
  type: string,
  preferences: NotificationPreferences,
  data?: Record<string, string | number | boolean | null>,
) {
  const lower = type.toLowerCase();
  const iconKey = typeof data?.iconKey === "string" ? data.iconKey.toLowerCase() : "";

  const isEventType = lower.startsWith("event_") || lower === "new_event";
  const isNoticeType = lower.startsWith("notice_");
  const isMarketplaceType =
    lower === "book_listed" ||
    lower === "new_book" ||
    lower === "purchase_request" ||
    lower === "request_response" ||
    lower.startsWith("lost_found_") ||
    iconKey === "book" ||
    iconKey === "lost_found";
  const isClassroomType =
    lower === "new_assignment" ||
    lower === "grading_update" ||
    lower === "assignment_deadline" ||
    iconKey === "classroom";
  const isChatType = lower === "chat_message" || lower === "chat_mention";
  const isAdminType =
    lower.startsWith("admin_") ||
    lower === "role_changed" ||
    lower === "security_alert" ||
    lower === "system_announcement";

  if (isEventType && !preferences.eventReminders) return false;
  if (isNoticeType && !preferences.noticeUpdates) return false;
  if (isMarketplaceType && !preferences.marketplaceAlerts) return false;
  if (isClassroomType && !preferences.classroomAlerts) return false;
  if (isChatType && !preferences.chatAlerts) return false;
  if (isAdminType && !preferences.adminAlerts) return false;

  return true;
}

function getPreferenceTypeFilter(preferences: NotificationPreferences) {
  const filters: SQL[] = [];

  if (!preferences.eventReminders) {
    filters.push(
      sql`not (
        ${notifications.type} like 'event_%'
        or ${notifications.type} = 'new_event'
      )`,
    );
  }

  if (!preferences.marketplaceAlerts) {
    filters.push(
      sql`not (
        ${notifications.type} in ('book_listed', 'new_book', 'purchase_request', 'request_response', 'purchase_request_cancelled', 'purchase_request_removed', 'lost_found_claim_received', 'lost_found_claim_accepted', 'lost_found_claim_rejected', 'lost_found_claim_cancelled', 'lost_found_resolved')
        or coalesce(${notifications.data}->>'iconKey', '') in ('book', 'lost_found')
      )`,
    );
  }

  if (!preferences.noticeUpdates) {
    filters.push(sql`not (${notifications.type} like 'notice_%')`);
  }
  if (!preferences.classroomAlerts) {
    filters.push(
      sql`not (
        ${notifications.type} in ('new_assignment', 'grading_update', 'assignment_deadline')
        or coalesce(${notifications.data}->>'iconKey', '') = 'classroom'
      )`,
    );
  }
  if (!preferences.chatAlerts) {
    filters.push(sql`not (${notifications.type} in ('chat_message', 'chat_mention'))`);
  }
  if (!preferences.adminAlerts) {
    filters.push(
      sql`not (
        ${notifications.type} like 'admin_%'
        or ${notifications.type} in ('role_changed', 'security_alert', 'system_announcement')
      )`,
    );
  }

  if (filters.length === 0) return null;
  return and(...filters);
}

function buildVisibilityFilter(
  userId: string,
  role?: UserRole,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
) {
  const roleTypeFilter = getRoleTypeFilter(role);
  const preferenceTypeFilter = getPreferenceTypeFilter(preferences);

  const baseFilters: SQL[] = [
    or(
      eq(notifications.recipientId, userId),
      inArray(notifications.audience, getVisibleAudiencesForRole(role)),
    ),
    sql`not (
      ${notifications.type} = 'book_listed'
      and coalesce(${notifications.data}->>'sellerId', '') = ${userId}
    )`,
    sql`not (
      ${notifications.type} = 'event_published'
      and (
        coalesce(${notifications.data}->>'publisherId', '') = ${userId}
        or (
          coalesce(${notifications.data}->>'publisherId', '') = ''
          and (${notifications.data}->>'eventId') ~ '^[0-9]+$'
          and exists (
            select 1
            from ${events} e
            inner join ${clubs} c on c.id = e.club_id
            where e.id = (${notifications.data}->>'eventId')::int
              and c.auth_club_id = ${userId}
          )
        )
      )
    )`,
    sql`not (
      ${notifications.type} in ('notice_created', 'notice_updated', 'notice_deleted')
      and coalesce(${notifications.data}->>'publisherId', '') = ${userId}
    )`,
    // Hide stale publish/update notifications if the notice no longer exists.
    sql`not (
      ${notifications.type} in ('notice_created', 'notice_updated')
      and (${notifications.data}->>'noticeId') ~ '^[0-9]+$'
      and not exists (
        select 1
        from ${notice} n
        where n.id = (${notifications.data}->>'noticeId')::int
      )
    )`,
    sql`not (
      ${notifications.type} = 'lost_found_published'
      and coalesce(${notifications.data}->>'publisherId', '') = ${userId}
    )`,
  ];

  // Notice removal notifications are admin-only regardless of stored audience.
  if (role !== "admin") {
    baseFilters.push(sql`${notifications.type} <> 'notice_deleted'`);
  }

  const baseFilter = and(...baseFilters);

  const combined: SQL[] = [baseFilter];
  if (roleTypeFilter) combined.push(roleTypeFilter);
  if (preferenceTypeFilter) combined.push(preferenceTypeFilter);

  return combined.length > 1 ? and(...combined) : combined[0];
}

export async function getNotificationPreferencesForUser(userId: string) {
  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      notificationPreferences: true,
    },
  });

  return {
    success: true,
    data: normalizeNotificationPreferences(dbUser?.notificationPreferences),
  };
}

export async function updateNotificationPreferencesForUser(
  userId: string,
  patch: Partial<NotificationPreferences>,
) {
  const existing = await getNotificationPreferencesForUser(userId);
  const nextPreferences = mergeNotificationPreferences(existing.data, patch);

  await db
    .update(user)
    .set({
      notificationPreferences: nextPreferences,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  return {
    success: true,
    data: nextPreferences,
  };
}

export async function createInAppNotificationForUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  const prefs = await getNotificationPreferencesForUser(input.userId);
  if (!isNotificationTypeAllowedByPreferences(input.type, prefs.data, input.data)) {
    return null;
  }

  const [created] = await db
    .insert(notifications)
    .values({
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      recipientId: input.userId,
      audience: "direct",
    })
    .returning();

  return created;
}

export async function createInAppNotificationsForUsers(input: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  const uniqueUserIds = [...new Set(input.userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return [];

  const userRows = await db.query.user.findMany({
    where: inArray(user.id, uniqueUserIds),
    columns: {
      id: true,
      notificationPreferences: true,
    },
  });

  const allowedUserIds = new Set(
    userRows
      .filter((row) =>
        isNotificationTypeAllowedByPreferences(
          input.type,
          normalizeNotificationPreferences(row.notificationPreferences),
          input.data,
        ),
      )
      .map((row) => row.id),
  );

  if (allowedUserIds.size === 0) return [];

  const rows = uniqueUserIds
    .filter((userId) => allowedUserIds.has(userId))
    .map((userId) => ({
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    recipientId: userId,
    audience: "direct" as const,
    }));

  return db.insert(notifications).values(rows).returning();
}

export async function createInAppNotificationForAudience(input: {
  audience: Exclude<Audience, "direct">;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  const [created] = await db
    .insert(notifications)
    .values({
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      audience: input.audience,
      recipientId: null,
    })
    .returning();

  return created;
}

export async function hasUnreadNotificationOfTypes(input: {
  userId: string;
  types: string[];
  since?: Date;
  conversationId?: number;
}) {
  const typeList = [...new Set(input.types.filter(Boolean))];
  if (typeList.length === 0) return false;

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, input.userId),
        inArray(notifications.type, typeList),
        isNull(
          sql`(
            select ${notificationReads.id}
            from ${notificationReads}
            where ${notificationReads.notificationId} = ${notifications.id}
              and ${notificationReads.userId} = ${input.userId}
            limit 1
          )`,
        ),
        input.since ? sql`${notifications.createdAt} >= ${input.since}` : sql`true`,
        input.conversationId
          ? sql`coalesce(${notifications.data}->>'conversationId', '') = ${String(
              input.conversationId,
            )}`
          : sql`true`,
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function hasNotificationByReminderKey(input: {
  type: string;
  userId?: string | null;
  reminderKey: string;
}) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, input.type),
        input.userId ? eq(notifications.recipientId, input.userId) : sql`true`,
        sql`coalesce(${notifications.data}->>'reminderKey', '') = ${input.reminderKey}`,
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function deleteNoticeNotificationsByNoticeId(input: {
  noticeId: number;
  types?: string[];
}) {
  const types =
    input.types && input.types.length > 0
      ? input.types
      : ["notice_created", "notice_updated"];

  const deletedRows = await db
    .delete(notifications)
    .where(
      and(
        inArray(notifications.type, types),
        sql`coalesce(${notifications.data}->>'noticeId', '') = ${String(
          input.noticeId,
        )}`,
      ),
    )
    .returning({ id: notifications.id });

  return { success: true, deleted: deletedRows.length };
}

export async function listInAppNotifications(
  userId: string,
  role?: UserRole,
  options?: { limit?: number; offset?: number; type?: string; unreadOnly?: boolean },
) {
  const limit = Math.max(1, Math.min(options?.limit ?? 30, 100));
  const offset = Math.max(0, options?.offset ?? 0);

  const prefs = await getNotificationPreferencesForUser(userId);
  const filters: SQL[] = [buildVisibilityFilter(userId, role, prefs.data)!];

  if (options?.type) {
    filters.push(eq(notifications.type, options.type));
  }

  const unreadJoinFilter = and(
    eq(notificationReads.notificationId, notifications.id),
    eq(notificationReads.userId, userId),
  );

  if (options?.unreadOnly) {
    filters.push(
      isNull(
        sql`(
          select ${notificationReads.id}
          from ${notificationReads}
          where ${notificationReads.notificationId} = ${notifications.id}
            and ${notificationReads.userId} = ${userId}
          limit 1
        )`,
      ),
    );
  }

  const whereClause = filters.length > 1 ? and(...filters) : filters[0];

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(whereClause);

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      data: notifications.data,
      recipientId: notifications.recipientId,
      audience: notifications.audience,
      createdAt: notifications.createdAt,
      readAt: notificationReads.readAt,
    })
    .from(notifications)
    .leftJoin(notificationReads, unreadJoinFilter)
    .where(whereClause)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const enrichedData = await enrichNotificationData(
    rows.map((row) => ({ type: row.type, data: row.data })),
  );

  return {
    success: true,
    data: rows.map((row, index) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: enrichedData[index],
      recipientId: row.recipientId,
      audience: row.audience,
      createdAt: row.createdAt,
      isRead: !!row.readAt,
      readAt: row.readAt,
    })),
    meta: {
      total: countRow?.count ?? 0,
      limit,
      offset,
    },
  };
}

export async function getUnreadNotificationCount(userId: string, role?: UserRole) {
  const prefs = await getNotificationPreferencesForUser(userId);
  const visibility = buildVisibilityFilter(userId, role, prefs.data);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(notifications)
    .where(
      and(
        visibility,
        isNull(
          sql`(
            select ${notificationReads.id}
            from ${notificationReads}
            where ${notificationReads.notificationId} = ${notifications.id}
              and ${notificationReads.userId} = ${userId}
            limit 1
          )`,
        ),
      ),
    );

  return { success: true, count: row?.count ?? 0 };
}

export async function markNotificationAsRead(
  notificationId: number,
  userId: string,
  role?: UserRole,
) {
  const prefs = await getNotificationPreferencesForUser(userId);
  const visible = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.id, notificationId),
      buildVisibilityFilter(userId, role, prefs.data)!,
    ),
    columns: { id: true },
  });

  if (!visible) return { success: false, message: "Notification not found." };

  await db
    .insert(notificationReads)
    .values({
      notificationId,
      userId,
      readAt: new Date(),
    })
    .onConflictDoNothing();

  return { success: true };
}

export async function markAllNotificationsAsRead(userId: string, role?: UserRole) {
  const prefs = await getNotificationPreferencesForUser(userId);
  const visibility = buildVisibilityFilter(userId, role, prefs.data);
  const visibleRows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(visibility);

  if (visibleRows.length === 0) return { success: true, updated: 0 };

  await db
    .insert(notificationReads)
    .values(
      visibleRows.map((row) => ({
        notificationId: row.id,
        userId,
        readAt: new Date(),
      })),
    )
    .onConflictDoNothing();

  return { success: true, updated: visibleRows.length };
}
