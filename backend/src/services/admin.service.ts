import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { bookListings } from "../models/book_buy_sell-schema.js";
import {
  marketplaceReports,
  sellerRatings,
  userBlocks,
} from "../models/trust-schema.js";
import {
  listModerationReports,
  reviewMarketplaceReport,
  type ReportStatus,
} from "./trust.service.js";

const ALLOWED_ROLES = [
  "student",
  "teacher",
  "admin",
  "notice_manager",
  "guest",
] as const;

export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function listUsersForAdmin(filters: {
  search?: string;
  role?: string;
  limit?: number;
}) {
  const { search, role, limit = 150 } = filters;

  const conditions = [];

  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(or(ilike(user.name, searchTerm), ilike(user.email, searchTerm)));
  }

  if (role?.trim()) {
    conditions.push(eq(user.role, role.trim()));
  }

  const users = await db.query.user.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(user.createdAt)],
    limit,
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isVerifiedSeller: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const userIds = users.map((u) => u.id);

  const ratings = userIds.length
    ? await db
        .select({
          sellerId: sellerRatings.sellerId,
          averageRating: sql<number>`coalesce(avg(${sellerRatings.rating})::numeric, 0)`,
          totalRatings: sql<number>`count(*)::int`,
        })
        .from(sellerRatings)
        .where(inArray(sellerRatings.sellerId, userIds))
        .groupBy(sellerRatings.sellerId)
    : [];

  const ratingsMap = new Map(
    ratings.map((r) => [r.sellerId, { averageRating: Number(r.averageRating), totalRatings: r.totalRatings }]),
  );

  return {
    success: true,
    data: users.map((u) => ({
      ...u,
      reputation: ratingsMap.get(u.id) ?? { averageRating: 0, totalRatings: 0 },
    })),
  };
}

export async function updateUserRoleByAdmin(input: {
  targetUserId: string;
  role: AllowedRole;
}) {
  const { targetUserId, role } = input;

  if (!ALLOWED_ROLES.includes(role)) {
    return { success: false, message: "Invalid role." };
  }

  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, targetUserId),
    columns: { id: true, role: true },
  });

  if (!targetUser) {
    return { success: false, message: "User not found." };
  }

  if (targetUser.role === "admin" && role !== "admin") {
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.role, "admin"));

    if ((adminCount?.count ?? 0) <= 1) {
      return {
        success: false,
        message: "You cannot remove the last admin account.",
      };
    }
  }

  const [updated] = await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerifiedSeller: user.isVerifiedSeller,
    });

  return {
    success: true,
    data: updated,
    message: "User role updated.",
  };
}

export async function setSellerVerificationByAdmin(input: {
  targetUserId: string;
  verified: boolean;
}) {
  const { targetUserId, verified } = input;

  const [updated] = await db
    .update(user)
    .set({ isVerifiedSeller: verified, updatedAt: new Date() })
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerifiedSeller: user.isVerifiedSeller,
    });

  if (!updated) {
    return { success: false, message: "User not found." };
  }

  return {
    success: true,
    data: updated,
    message: verified ? "Seller verified." : "Seller verification removed.",
  };
}

export async function getAdminDashboardStats() {
  const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  const [adminCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(eq(user.role, "admin"));

  const [teacherCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(eq(user.role, "teacher"));

  const [availableListings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookListings)
    .where(eq(bookListings.status, "available"));

  const [openReports] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marketplaceReports)
    .where(inArray(marketplaceReports.status, ["open", "in_review"]));

  const [totalBlocks] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBlocks);

  const [ratingSummary] = await db
    .select({
      count: sql<number>`count(*)::int`,
      avg: sql<number>`coalesce(avg(${sellerRatings.rating})::numeric, 0)`,
    })
    .from(sellerRatings);

  return {
    success: true,
    data: {
      users: usersCount?.count ?? 0,
      admins: adminCount?.count ?? 0,
      teachers: teacherCount?.count ?? 0,
      listingsAvailable: availableListings?.count ?? 0,
      openReports: openReports?.count ?? 0,
      activeBlocks: totalBlocks?.count ?? 0,
      ratingsCount: ratingSummary?.count ?? 0,
      averageSellerRating: Number(Number(ratingSummary?.avg ?? 0).toFixed(1)),
    },
  };
}

export async function getModerationReports(status?: ReportStatus) {
  return listModerationReports(status);
}

export async function updateModerationReport(input: {
  reportId: number;
  reviewerId: string;
  status: ReportStatus;
  resolutionNotes?: string;
}) {
  return reviewMarketplaceReport(input);
}


export async function listAllRatingsForAdmin() {
  const ratings = await db.query.sellerRatings.findMany({
    orderBy: [desc(sellerRatings.createdAt)],
    with: {
      rater: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      listing: {
        columns: {
          id: true,
          title: true,
        },
      },
    },
  });

  const sellerIds = [...new Set(ratings.map((r) => r.sellerId))];
  const sellers = sellerIds.length
    ? await db.query.user.findMany({
        where: inArray(user.id, sellerIds),
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      })
    : [];

  const sellersMap = new Map(sellers.map((s) => [s.id, s]));

  return {
    success: true,
    data: ratings.map((r) => ({
      ...r,
      seller: sellersMap.get(r.sellerId) || null,
    })),
  };
}

export async function listAllBlocksForAdmin() {
  const blocks = await db.query.userBlocks.findMany({
    orderBy: [desc(userBlocks.createdAt)],
    with: {
      blockedUser: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  const blockerIds = [...new Set(blocks.map((b) => b.blockerId))];
  const blockers = blockerIds.length
    ? await db.query.user.findMany({
        where: inArray(user.id, blockerIds),
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      })
    : [];

  const blockersMap = new Map(blockers.map((b) => [b.id, b]));

  return {
    success: true,
    data: blocks.map((b) => ({
      ...b,
      blocker: blockersMap.get(b.blockerId) || null,
    })),
  };
}

export async function unblockUserByAdmin(blockId: number) {
  const [deleted] = await db
    .delete(userBlocks)
    .where(eq(userBlocks.id, blockId))
    .returning();

  if (!deleted) {
    return { success: false, message: "Block record not found." };
  }

  return {
    success: true,
    message: "User unblocked successfully by admin.",
    data: deleted,
  };
}
