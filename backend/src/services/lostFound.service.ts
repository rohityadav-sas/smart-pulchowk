import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  lostFoundClaims,
  lostFoundImages,
  lostFoundItems,
  type LostFoundClaim,
} from "../models/lost-found-schema.js";
import { user } from "../models/auth-schema.js";
import { createInAppNotificationForUser } from "./inAppNotification.service.js";
import { sendToUser } from "./notification.service.js";

type ItemType = "lost" | "found";
type ItemStatus = "open" | "claimed" | "resolved" | "closed";
type ItemCategory =
  | "documents"
  | "electronics"
  | "accessories"
  | "ids_cards"
  | "keys"
  | "bags"
  | "other";
type ClaimStatus = "pending" | "accepted" | "rejected" | "cancelled";

interface CursorPayload {
  createdAt: string;
  id: number;
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed?.createdAt === "string" &&
      Number.isInteger(parsed?.id) &&
      parsed.id > 0
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function isNonGuestRole(role?: string) {
  if (!role) return false;
  return role !== "guest";
}

async function safeCreateNotification(
  context: string,
  run: () => Promise<unknown>,
) {
  try {
    await run();
  } catch (error) {
    console.error(`LostFound notification error (${context}):`, error);
  }
}

function normalizeLimit(limit?: number) {
  const parsed = Number(limit ?? 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

function buildCursorFilter(cursor?: string | null) {
  const parsed = decodeCursor(cursor);
  if (!parsed) return null;
  const cursorDate = new Date(parsed.createdAt);
  if (Number.isNaN(cursorDate.getTime())) return null;
  return or(
    sql`${lostFoundItems.createdAt} < ${cursorDate}`,
    and(eq(lostFoundItems.createdAt, cursorDate), sql`${lostFoundItems.id} < ${parsed.id}`),
  );
}

function mapItem(item: any) {
  return {
    ...item,
    images: (item.images || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
  };
}

export async function createLostFoundItem(
  userId: string,
  role: string | undefined,
  payload: {
    itemType: ItemType;
    title: string;
    description: string;
    category: ItemCategory;
    lostFoundDate: string;
    locationText: string;
    contactNote?: string | null;
    rewardText?: string | null;
  },
) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot create lost/found posts." };
  }

  const title = payload.title?.trim();
  const description = payload.description?.trim();
  const locationText = payload.locationText?.trim();
  if (!title || !description || !locationText) {
    return { success: false, message: "Title, description, and location are required." };
  }

  const dateValue = new Date(payload.lostFoundDate);
  if (Number.isNaN(dateValue.getTime())) {
    return { success: false, message: "Invalid lost/found date." };
  }

  const [created] = await db
    .insert(lostFoundItems)
    .values({
      ownerId: userId,
      itemType: payload.itemType,
      title,
      description,
      category: payload.category,
      lostFoundDate: dateValue,
      locationText,
      contactNote: payload.contactNote?.trim() || null,
      rewardText: payload.rewardText?.trim() || null,
      status: "open",
    })
    .returning();

  return { success: true, data: created, message: "Lost/found post created successfully." };
}

export async function updateLostFoundItem(
  itemId: number,
  userId: string,
  role: string | undefined,
  payload: Partial<{
    title: string;
    description: string;
    category: ItemCategory;
    lostFoundDate: string;
    locationText: string;
    contactNote: string | null;
    rewardText: string | null;
    status: ItemStatus;
  }>,
) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot update lost/found posts." };
  }

  const existing = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
  });
  if (!existing) return { success: false, message: "Lost/found item not found." };
  if (existing.ownerId !== userId) {
    return { success: false, message: "You are not authorized to update this item." };
  }

  const patch: Record<string, unknown> = {};
  if (typeof payload.title === "string") patch.title = payload.title.trim();
  if (typeof payload.description === "string") patch.description = payload.description.trim();
  if (typeof payload.category === "string") patch.category = payload.category;
  if (typeof payload.locationText === "string") patch.locationText = payload.locationText.trim();
  if (payload.contactNote !== undefined) patch.contactNote = payload.contactNote?.trim() || null;
  if (payload.rewardText !== undefined) patch.rewardText = payload.rewardText?.trim() || null;
  if (typeof payload.status === "string") patch.status = payload.status;
  if (typeof payload.lostFoundDate === "string") {
    const dateValue = new Date(payload.lostFoundDate);
    if (Number.isNaN(dateValue.getTime())) {
      return { success: false, message: "Invalid lost/found date." };
    }
    patch.lostFoundDate = dateValue;
  }
  patch.updatedAt = new Date();

  const [updated] = await db
    .update(lostFoundItems)
    .set(patch)
    .where(eq(lostFoundItems.id, itemId))
    .returning();

  return { success: true, data: updated, message: "Lost/found item updated successfully." };
}

export async function deleteLostFoundItem(itemId: number, userId: string, role?: string) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot delete lost/found posts." };
  }
  const existing = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    columns: { id: true, ownerId: true },
  });
  if (!existing) return { success: false, message: "Lost/found item not found." };
  if (existing.ownerId !== userId) {
    return { success: false, message: "You are not authorized to delete this item." };
  }

  await db.delete(lostFoundItems).where(eq(lostFoundItems.id, itemId));
  return { success: true, message: "Lost/found item deleted successfully." };
}

export async function listLostFoundItems(filters: {
  itemType?: ItemType;
  category?: ItemCategory;
  status?: ItemStatus;
  q?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const limit = normalizeLimit(filters.limit);
  const baseFilters: any[] = [];

  if (filters.itemType) baseFilters.push(eq(lostFoundItems.itemType, filters.itemType));
  if (filters.category) baseFilters.push(eq(lostFoundItems.category, filters.category));
  if (filters.status) baseFilters.push(eq(lostFoundItems.status, filters.status));
  else baseFilters.push(inArray(lostFoundItems.status, ["open", "claimed"]));
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    baseFilters.push(
      or(
        ilike(lostFoundItems.title, term),
        ilike(lostFoundItems.description, term),
        ilike(lostFoundItems.locationText, term),
      ),
    );
  }

  const cursorFilter = buildCursorFilter(filters.cursor);
  const pageFilters = cursorFilter ? [...baseFilters, cursorFilter] : [...baseFilters];

  const whereClause = pageFilters.length > 1 ? and(...pageFilters) : pageFilters[0];
  const rows = await db.query.lostFoundItems.findMany({
    where: whereClause,
    orderBy: [desc(lostFoundItems.createdAt), desc(lostFoundItems.id)],
    limit: limit + 1,
    with: {
      owner: {
        columns: { id: true, name: true, image: true, role: true },
      },
      images: true,
    },
  });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lostFoundItems)
    .where(
      baseFilters.length > 0
        ? baseFilters.length > 1
          ? and(...baseFilters)
          : baseFilters[0]
        : undefined,
    );

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapItem);
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          createdAt: new Date(last.createdAt).toISOString(),
          id: Number(last.id),
        })
      : null;

  return {
    success: true,
    data: { items, nextCursor, hasMore },
    meta: { total: countRow?.count ?? items.length, limit },
  };
}

export async function getLostFoundItemById(itemId: number, viewerUserId?: string) {
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    with: {
      owner: {
        columns: { id: true, name: true, image: true, role: true },
      },
      images: true,
      claims: {
        columns: {
          id: true,
          requesterId: true,
          status: true,
          message: true,
          createdAt: true,
        },
      },
    },
  });

  if (!item) return { success: false, message: "Lost/found item not found." };

  const viewerClaim =
    viewerUserId && viewerUserId !== item.ownerId
      ? item.claims.find((claim) => claim.requesterId === viewerUserId) || null
      : null;

  return {
    success: true,
    data: {
      ...mapItem(item),
      claims: undefined,
      claimSummary: {
        total: item.claims.length,
        pending: item.claims.filter((claim) => claim.status === "pending").length,
        accepted: item.claims.filter((claim) => claim.status === "accepted").length,
      },
      viewerClaim,
      isOwner: !!viewerUserId && viewerUserId === item.ownerId,
    },
  };
}

export async function addLostFoundImage(
  itemId: number,
  userId: string,
  role: string | undefined,
  imageUrl: string,
  cloudinaryPublicId?: string | null,
) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot add images." };
  }
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    columns: { id: true, ownerId: true },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId !== userId) {
    return { success: false, message: "You are not authorized to update this item." };
  }

  const [orderRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${lostFoundImages.sortOrder}), -1)` })
    .from(lostFoundImages)
    .where(eq(lostFoundImages.itemId, itemId));
  const nextOrder = (orderRow?.maxOrder ?? -1) + 1;

  const [created] = await db
    .insert(lostFoundImages)
    .values({
      itemId,
      imageUrl,
      cloudinaryPublicId: cloudinaryPublicId || null,
      sortOrder: nextOrder,
    })
    .returning();

  return { success: true, data: created };
}

export async function deleteLostFoundImage(
  itemId: number,
  imageId: number,
  userId: string,
  role: string | undefined,
) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot delete images." };
  }
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    columns: { ownerId: true },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId !== userId) {
    return { success: false, message: "You are not authorized to update this item." };
  }

  const [deleted] = await db
    .delete(lostFoundImages)
    .where(and(eq(lostFoundImages.id, imageId), eq(lostFoundImages.itemId, itemId)))
    .returning();
  if (!deleted) return { success: false, message: "Image not found." };
  return { success: true, data: deleted };
}

export async function createClaimRequest(
  itemId: number,
  requesterId: string,
  role: string | undefined,
  message: string,
) {
  if (!isNonGuestRole(role)) {
    return { success: false, message: "Guest users cannot submit claim requests." };
  }

  const trimmedMessage = message?.trim();
  if (!trimmedMessage) return { success: false, message: "Claim message is required." };

  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    with: {
      owner: {
        columns: { name: true },
      },
      images: {
        orderBy: [asc(lostFoundImages.sortOrder)],
        limit: 1,
      },
    },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId === requesterId) {
    return { success: false, message: "You cannot claim your own item." };
  }
  if (item.itemType !== "found") {
    return {
      success: false,
      message: "Claim requests are only available for found items.",
    };
  }
  if (item.status === "resolved" || item.status === "closed") {
    return { success: false, message: "This item is no longer accepting claims." };
  }

  const existing = await db.query.lostFoundClaims.findFirst({
    where: and(
      eq(lostFoundClaims.itemId, itemId),
      eq(lostFoundClaims.requesterId, requesterId),
    ),
  });

  let created: LostFoundClaim;
  if (existing) {
    if (existing.status === "pending" || existing.status === "accepted") {
      return {
        success: false,
        message: "You already have an active claim request for this item.",
      };
    }
    const [reopened] = await db
      .update(lostFoundClaims)
      .set({
        status: "pending",
        message: trimmedMessage,
        updatedAt: new Date(),
      })
      .where(eq(lostFoundClaims.id, existing.id))
      .returning();
    created = reopened;
  } else {
    const [inserted] = await db
      .insert(lostFoundClaims)
      .values({
        itemId,
        requesterId,
        message: trimmedMessage,
        status: "pending",
      })
      .returning();
    created = inserted;
  }

  const requester = await db.query.user.findFirst({
    where: eq(user.id, requesterId),
    columns: { id: true, name: true, image: true },
  });

  await sendToUser(item.ownerId, {
    title: "New claim request",
    body: `Someone requested your ${item.itemType} item: ${item.title}.`,
    data: {
      type: "lost_found_claim_received",
      itemId: item.id.toString(),
      claimId: created.id.toString(),
      itemType: item.itemType,
      iconKey: "lost_found",
      thumbnailUrl: item.images[0]?.imageUrl || "",
    },
  });
  const requesterName = requester?.name?.trim() || "Someone";
  const actionText =
    item.itemType === "found"
      ? "claimed your found item"
      : "has a comment on your lost item";

  await safeCreateNotification("claim_received", () =>
    createInAppNotificationForUser({
      userId: item.ownerId,
      type: "lost_found_claim_received",
      title: "New claim request",
      body: `${requesterName} ${actionText}: ${item.title}.`,
      data: {
        itemId: item.id,
        claimId: created.id,
        itemType: item.itemType,
        itemTitle: item.title,
        actorId: requester?.id || requesterId,
        actorName: requesterName,
        actorAvatarUrl: requester?.image || null,
        iconKey: "lost_found",
        thumbnailUrl: item.images[0]?.imageUrl || null,
      },
    }),
  );

  return { success: true, data: created, message: "Claim request sent." };
}

export async function listClaimsForOwnerItem(
  itemId: number,
  ownerId: string,
  role?: string,
) {
  if (!isNonGuestRole(role)) return { success: false, message: "Unauthorized." };
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    columns: { id: true, ownerId: true },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId !== ownerId) return { success: false, message: "Forbidden." };

  const claims = await db.query.lostFoundClaims.findMany({
    where: eq(lostFoundClaims.itemId, itemId),
    orderBy: [desc(lostFoundClaims.createdAt)],
    with: {
      requester: {
        columns: { id: true, name: true, image: true, email: true, role: true },
      },
    },
  });

  return { success: true, data: claims };
}

export async function setClaimStatus(
  itemId: number,
  claimId: number,
  ownerId: string,
  role: string | undefined,
  nextStatus: Extract<ClaimStatus, "accepted" | "rejected" | "cancelled">,
) {
  if (!isNonGuestRole(role)) return { success: false, message: "Unauthorized." };
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    with: {
      images: {
        orderBy: [asc(lostFoundImages.sortOrder)],
        limit: 1,
      },
    },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId !== ownerId) return { success: false, message: "Forbidden." };

  const claim = await db.query.lostFoundClaims.findFirst({
    where: and(eq(lostFoundClaims.id, claimId), eq(lostFoundClaims.itemId, itemId)),
  });
  if (!claim) return { success: false, message: "Claim request not found." };
  if (claim.status !== "pending") {
    return { success: false, message: "Only pending claims can be updated." };
  }

  const [updatedClaim] = await db
    .update(lostFoundClaims)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(
      and(
        eq(lostFoundClaims.id, claimId),
        eq(lostFoundClaims.itemId, itemId),
        eq(lostFoundClaims.status, "pending"),
      ),
    )
    .returning();

  if (!updatedClaim) return { success: false, message: "Failed to update claim." };

  if (nextStatus === "accepted") {
    await db
      .update(lostFoundClaims)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(lostFoundClaims.itemId, itemId),
          ne(lostFoundClaims.id, claimId),
          eq(lostFoundClaims.status, "pending"),
        ),
      );
    await db
      .update(lostFoundItems)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(eq(lostFoundItems.id, itemId));
  }

  await sendToUser(updatedClaim.requesterId, {
    title:
      nextStatus === "accepted"
        ? "Claim accepted"
        : nextStatus === "rejected"
          ? "Claim rejected"
          : "Claim cancelled",
    body:
      nextStatus === "accepted"
        ? `Your claim for "${item.title}" was accepted.`
        : nextStatus === "rejected"
          ? `Your claim for "${item.title}" was rejected.`
          : `Your claim for "${item.title}" was cancelled.`,
    data: {
      type:
        nextStatus === "accepted"
          ? "lost_found_claim_accepted"
          : nextStatus === "rejected"
            ? "lost_found_claim_rejected"
            : "lost_found_claim_cancelled",
      itemId: item.id.toString(),
      claimId: updatedClaim.id.toString(),
      itemType: item.itemType,
      iconKey: "lost_found",
      thumbnailUrl: item.images[0]?.imageUrl || "",
    },
  });

  await safeCreateNotification("claim_status_updated", () =>
    createInAppNotificationForUser({
      userId: updatedClaim.requesterId,
      type:
        nextStatus === "accepted"
          ? "lost_found_claim_accepted"
          : nextStatus === "rejected"
            ? "lost_found_claim_rejected"
            : "lost_found_claim_cancelled",
      title:
        nextStatus === "accepted"
          ? "Claim accepted"
          : nextStatus === "rejected"
            ? "Claim rejected"
            : "Claim cancelled",
      body:
        nextStatus === "accepted"
          ? `Your claim for "${item.title}" was accepted.`
          : nextStatus === "rejected"
            ? `Your claim for "${item.title}" was rejected.`
            : `Your claim for "${item.title}" was cancelled.`,
      data: {
        itemId: item.id,
        claimId: updatedClaim.id,
        itemType: item.itemType,
        itemTitle: item.title,
        iconKey: "lost_found",
        thumbnailUrl: item.images[0]?.imageUrl || null,
      },
    }),
  );

  return { success: true, data: updatedClaim, message: "Claim status updated." };
}

export async function markItemStatus(
  itemId: number,
  ownerId: string,
  role: string | undefined,
  status: ItemStatus,
) {
  if (!isNonGuestRole(role)) return { success: false, message: "Unauthorized." };
  const item = await db.query.lostFoundItems.findFirst({
    where: eq(lostFoundItems.id, itemId),
    with: {
      images: {
        orderBy: [asc(lostFoundImages.sortOrder)],
        limit: 1,
      },
    },
  });
  if (!item) return { success: false, message: "Lost/found item not found." };
  if (item.ownerId !== ownerId) return { success: false, message: "Forbidden." };

  const [updated] = await db
    .update(lostFoundItems)
    .set({ status, updatedAt: new Date() })
    .where(eq(lostFoundItems.id, itemId))
    .returning();

  if (status === "resolved") {
    const acceptedClaims = await db.query.lostFoundClaims.findMany({
      where: and(
        eq(lostFoundClaims.itemId, itemId),
        eq(lostFoundClaims.status, "accepted"),
      ),
      columns: { requesterId: true },
    });

    await Promise.all(
      acceptedClaims.map(async (claim) => {
        await sendToUser(claim.requesterId, {
          title: "Item marked as resolved",
          body: `The owner marked "${item.title}" as resolved.`,
          data: {
            type: "lost_found_resolved",
            itemId: item.id.toString(),
            itemType: item.itemType,
            iconKey: "lost_found",
            thumbnailUrl: item.images[0]?.imageUrl || "",
          },
        });
        await safeCreateNotification("item_resolved", () =>
          createInAppNotificationForUser({
            userId: claim.requesterId,
            type: "lost_found_resolved",
            title: "Item marked as resolved",
            body: `The owner marked "${item.title}" as resolved.`,
            data: {
              itemId: item.id,
              itemType: item.itemType,
              itemTitle: item.title,
              iconKey: "lost_found",
              thumbnailUrl: item.images[0]?.imageUrl || null,
            },
          }),
        );
      }),
    );
  }

  return { success: true, data: updated, message: "Item status updated." };
}

export async function getMyLostFoundItems(userId: string, role?: string) {
  if (!isNonGuestRole(role)) return { success: false, message: "Unauthorized." };
  const items = await db.query.lostFoundItems.findMany({
    where: eq(lostFoundItems.ownerId, userId),
    orderBy: [desc(lostFoundItems.createdAt), desc(lostFoundItems.id)],
    with: {
      images: {
        orderBy: [asc(lostFoundImages.sortOrder)],
      },
    },
  });
  return { success: true, data: items.map(mapItem) };
}

export async function getMyLostFoundClaims(userId: string, role?: string) {
  if (!isNonGuestRole(role)) return { success: false, message: "Unauthorized." };
  const claims = await db.query.lostFoundClaims.findMany({
    where: eq(lostFoundClaims.requesterId, userId),
    orderBy: [desc(lostFoundClaims.createdAt), desc(lostFoundClaims.id)],
    with: {
      item: {
        with: {
          owner: {
            columns: { id: true, name: true, image: true },
          },
          images: {
            orderBy: [asc(lostFoundImages.sortOrder)],
          },
        },
      },
    },
  });
  return { success: true, data: claims };
}
