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
import { user } from "../models/auth-schema.js";

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
  if (lower.includes("event")) return "event";
  if (
    lower.includes("book") ||
    lower.includes("purchase") ||
    lower.includes("request") ||
    lower.includes("chat")
  ) {
    return "book";
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
  const actorUserIds = new Set<string>();

  for (const row of rows) {
    const data = (row.data || {}) as NotificationData;
    const eventId = parseNumericId(data.eventId);
    const noticeId = parseNumericId(data.noticeId);
    const listingId = parseNumericId(data.listingId) ?? parseNumericId(data.bookId);
    const requestId = parseNumericId(data.requestId);
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
    if (actorIdCandidate) actorUserIds.add(actorIdCandidate);
  }

  const [eventRows, noticeRows, listingImageRows, requestRows, actorRows] = await Promise.all([
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
  const actorMap = new Map<string, { name: string | null; image: string | null }>(
    actorRows.map((row) => [
      row.id,
      {
        name: row.name ?? null,
        image: row.image ?? null,
      },
    ]),
  );

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

      const eventMeta = eventId ? eventMap.get(eventId) : null;
      const noticeMeta = noticeId ? noticeMap.get(noticeId) : null;
      const listingMeta = listingId ? listingMap.get(listingId) : null;

      if (eventMeta?.bannerUrl) data.thumbnailUrl = eventMeta.bannerUrl;
      else if (noticeMeta?.attachmentUrl && isImageUrl(noticeMeta.attachmentUrl))
        data.thumbnailUrl = noticeMeta.attachmentUrl;
      else if (listingMeta?.imageUrl) data.thumbnailUrl = listingMeta.imageUrl;
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
    // Restrict notice managers to notice lifecycle notifications only.
    return sql`${notifications.type} like 'notice_%'`;
  }
  return null;
}

function buildVisibilityFilter(userId: string, role?: UserRole) {
  const roleTypeFilter = getRoleTypeFilter(role);

  const baseFilter = and(
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
      and (
        coalesce(${notifications.data}->>'publisherId', '') = ${userId}
        or (
          coalesce(${notifications.data}->>'publisherId', '') = ''
          and (${notifications.data}->>'noticeId') ~ '^[0-9]+$'
          and exists (
            select 1
            from ${notice} n
            where n.id = (${notifications.data}->>'noticeId')::int
              and n.author_id = ${userId}
          )
        )
      )
    )`,
  );

  if (roleTypeFilter) {
    return and(baseFilter, roleTypeFilter);
  }
  return baseFilter;
}

export async function createInAppNotificationForUser(input: {
  userId: string;
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

  const rows = uniqueUserIds.map((userId) => ({
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

export async function listInAppNotifications(
  userId: string,
  role?: UserRole,
  options?: { limit?: number; offset?: number; type?: string; unreadOnly?: boolean },
) {
  const limit = Math.max(1, Math.min(options?.limit ?? 30, 100));
  const offset = Math.max(0, options?.offset ?? 0);

  const filters: SQL[] = [buildVisibilityFilter(userId, role)!];

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
  const visibility = buildVisibilityFilter(userId, role);
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
  const visible = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, notificationId), buildVisibilityFilter(userId, role)!),
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
  const visibility = buildVisibilityFilter(userId, role);
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
