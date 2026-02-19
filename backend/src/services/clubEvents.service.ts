import { createClubInput } from "../types/events.js";
import { db } from "../lib/db.js";
import {
  clubs,
  events,
  clubAdmins,
  eventRegistrations,
} from "../models/event-schema.js"; // updated import
import { desc, eq, sql, and, or, asc, isNull } from "drizzle-orm"; // updated imports
import { user } from "../models/auth-schema.js";
import {
  uploadClubLogoToCloudinary,
  deleteImageFromCLoudinary,
  uploadEventBanner,
} from "./cloudinary.service.js";
import { UPLOAD_CONSTANTS, isValidImageUrl } from "../config/cloudinary.js";
import { unwrapOne } from "../lib/type-utils.js";
import { deriveEventStatus } from "../lib/event-status.js";
import { createInAppNotificationsForUsers } from "./inAppNotification.service.js";
import { sendToUser } from "./notification.service.js";

const { MAX_FILE_SIZE, ALLOWED_TYPES } = UPLOAD_CONSTANTS;

async function isAuthorizedForClub(userId: string, clubId: number) {
  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
    columns: { authClubId: true },
  });

  if (!club) return false;
  if (club.authClubId === userId) return true;

  const admin = await db.query.clubAdmins.findFirst({
    where: and(eq(clubAdmins.clubId, clubId), eq(clubAdmins.userId, userId)),
  });

  return !!admin;
}

export async function addClubAdmin(
  ownerId: string,
  clubId: number,
  newAdminEmail: string,
) {
  try {
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
    });

    if (!club) throw new Error("Club not found");
    if (club.authClubId !== ownerId)
      throw new Error("Only the owner can add admins");

    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, newAdminEmail),
    });

    if (!targetUser) throw new Error("User with this email not found");

    await db.insert(clubAdmins).values({
      clubId,
      userId: targetUser.id,
      role: "admin",
    });

    return { success: true, message: "Admin added successfully" };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function removeClubAdmin(
  ownerId: string,
  clubId: number,
  adminUserId: string,
) {
  try {
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
    });

    if (!club) throw new Error("Club not found");
    if (club.authClubId !== ownerId)
      throw new Error("Only the owner can remove admins");

    await db
      .delete(clubAdmins)
      .where(
        and(eq(clubAdmins.clubId, clubId), eq(clubAdmins.userId, adminUserId)),
      );

    return { success: true, message: "Admin removed successfully" };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getClubAdmins(clubId: number) {
  try {
    const admins = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(clubAdmins)
      .innerJoin(user, eq(clubAdmins.userId, user.id))
      .where(eq(clubAdmins.clubId, clubId));

    return { success: true, admins };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function createClub(
  authClubId: string,
  clubData: createClubInput,
) {
  try {
    if (!clubData) {
      throw Error("Request body is missing");
    }

    if (!clubData.name || clubData.name.trim().length === 0) {
      throw new Error("Club name is required");
    }

    if (!clubData.email) {
      throw new Error("Valid email is required");
    }

    const existingClub = await db.query.clubs.findFirst({
      where: eq(clubs.name, clubData.name),
    });

    if (existingClub) {
      throw new Error("Club with this name already exists");
    }

    const [newclub] = await db
      .insert(clubs)
      .values({
        authClubId: authClubId,
        name: clubData.name,
        description: clubData.description,
        email: clubData.email,
        logoUrl: clubData.logoUrl || null,
        logoPublicId: null,
        isActive: true,
      })
      .returning();

    return {
      success: true,
      club: newclub,
      message: "Club creatd successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function getClubs() {
  try {
    const existingClub = await db
      .select({
        id: clubs.id,
        authClubId: clubs.authClubId,
        name: clubs.name,
        description: clubs.description,
        email: clubs.email,
        logoUrl: clubs.logoUrl,
        upcomingEvents: sql<number>`
                    COUNT(DISTINCT CASE
                    WHEN ${events.status} IS NULL
                    AND (${events.eventStartTime} > NOW() OR (${events.eventStartTime} <= NOW() AND ${events.eventEndTime} >= NOW()))
                    THEN ${events.id}
                    END)`,
        completedEvents: sql<number>`
                    COUNT(DISTINCT CASE 
                    WHEN ${events.status} IS NULL 
                    AND ${events.eventEndTime} < NOW()
                    THEN ${events.id} 
                    END)
                `,
        totalParticipants: sql<number>`COALESCE(SUM(${events.currentParticipants}), 0)`,
      })
      .from(clubs)
      .leftJoin(events, eq(clubs.id, events.clubId))
      .where(eq(clubs.isActive, true))
      .groupBy(clubs.id)
      .orderBy(asc(clubs.name));

    return {
      success: true,
      existingClub,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function updateClubInfo(
  userId: string,
  clubId: number,
  clubData: createClubInput,
) {
  try {
    if (!(await isAuthorizedForClub(userId, clubId))) {
      throw new Error(
        "Unauthorized: Only club admins or owners can update info",
      );
    }
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
    });

    if (!club) {
      return {
        success: false,
        message: "No clubs found!!",
      };
    }

    const { logoUrl, ...otherClubData } = clubData;

    const updateClubData: any = {
      ...otherClubData,
      updatedAt: new Date(),
    };

    if (logoUrl !== undefined && logoUrl !== club.logoUrl) {
      if (logoUrl === null || logoUrl === "") {
        updateClubData.logoUrl = null;
        updateClubData.logoPublicId = null;
      } else if (typeof logoUrl === "string") {
        updateClubData.logoUrl = logoUrl;

        if (!logoUrl.includes("cloudinary.com")) {
          updateClubData.logoPublicId = null;
        }
      }
    }

    const updatedClub = await db
      .update(clubs)
      .set(updateClubData)
      .where(eq(clubs.id, clubId))
      .returning();

    return {
      success: true,
      message: "club Updated successfully",
      data: updatedClub,
    };
  } catch (error) {
    console.error(error.messsage);
    return {
      success: false,
      message: error.message || "Failed to update the club Info",
    };
  }
}

export async function getClubById(clubId: number) {
  try {
    const [clubData] = await db
      .select({
        id: clubs.id,
        authClubId: clubs.authClubId,
        name: clubs.name,
        description: clubs.description,
        email: clubs.email,
        logoUrl: clubs.logoUrl,
        isActive: clubs.isActive,
        createdAt: clubs.createdAt,
        upcomingEvents: sql<number>`
                    COUNT(DISTINCT CASE
                    WHEN ${events.status} IS NULL 
                    AND (${events.eventStartTime} > NOW() OR (${events.eventStartTime} <= NOW() AND ${events.eventEndTime} >= NOW()))
                    THEN ${events.id}
                    END)`,
        completedEvents: sql<number>`
                    COUNT(DISTINCT CASE 
                    WHEN ${events.status} IS NULL 
                    AND ${events.eventEndTime} < NOW()
                    THEN ${events.id} 
                    END)
                `,
        totalParticipants: sql<number>`
                    COALESCE(SUM(${events.currentParticipants}), 0)
                `,
      })
      .from(clubs)
      .leftJoin(events, eq(events.clubId, clubs.id))
      .where(and(eq(clubs.id, clubId), eq(clubs.isActive, true)))
      .groupBy(clubs.id);

    if (!clubData) {
      return null;
    }

    return {
      success: true,
      clubData,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function upadateClubLogoToDb(
  clubId: number,
  logoUrl: string,
  logoPublicId: string | null,
) {
  await db
    .update(clubs)
    .set({
      logoUrl,
      logoPublicId,
      updatedAt: new Date(),
    })
    .where(eq(clubs.id, clubId));
}

async function getClubLogoinfo(clubId: number) {
  const [club] = await db
    .select({
      logoUrl: clubs.logoUrl,
      logoPublicId: clubs.logoPublicId,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);

  return club;
}

export async function handleClubLogoUrlUpload(
  userId: string,
  clubId: number,
  imageUrl: string,
) {
  try {
    if (!(await isAuthorizedForClub(userId, clubId))) {
      throw new Error("Unauthorized to update logo for this club");
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return {
        success: true,
        message: "Image URL is required",
      };
    }

    if (!isValidImageUrl(imageUrl)) {
      return {
        success: false,
        message: "Invalid image URL format",
      };
    }

    const currentLogo = await getClubLogoinfo(clubId);

    if (currentLogo?.logoPublicId) {
      await deleteImageFromCLoudinary(currentLogo.logoPublicId);
    }

    await upadateClubLogoToDb(clubId, imageUrl, null);

    return {
      success: true,
      data: {
        url: imageUrl,
        publicId: null,
        source: "external",
      },
    };
  } catch (error) {
    console.error("URL upload error:", error);

    return {
      success: false,
      message: error.message || "Failed to save URL",
    };
  }
}

export async function handleCLubLogoFileUpload(
  userId: string,
  clubId: number,
  file: Express.Multer.File,
) {
  try {
    if (!(await isAuthorizedForClub(userId, clubId))) {
      throw new Error("Unauthorized to upload logo for this club");
    }
    if (!ALLOWED_TYPES.includes(file.mimetype as any)) {
      return {
        success: false,
        message: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        message: "File too large. Maximum size is 5MB",
      };
    }

    const currentLogo = await getClubLogoinfo(clubId);

    if (currentLogo?.logoPublicId) {
      await deleteImageFromCLoudinary(currentLogo.logoPublicId);
    }

    const buffer = file.buffer;
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    const uploadResult = await uploadClubLogoToCloudinary(clubId, dataUri);

    if (!uploadResult.success || !uploadResult.url) {
      return {
        success: false,
        message: uploadResult.message || "Upload failed",
      };
    }

    await upadateClubLogoToDb(
      clubId,
      uploadResult.url,
      uploadResult.publicId || null,
    );

    return {
      success: true,
      data: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        source: "cloudinary",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "upload failed",
    };
  }
}

export async function deleteClubLogo(userId: string, clubId: number) {
  try {
    if (!(await isAuthorizedForClub(userId, clubId))) {
      throw new Error("Unauthorized to delete logo for this club");
    }
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
      columns: {
        logoUrl: true,
        logoPublicId: true,
      },
    });

    if (!club) {
      return {
        success: false,
        message: "Club not found",
      };
    }

    if (!club.logoUrl) {
      return {
        success: false,
        message: "No logo to delete",
      };
    }

    if (club.logoPublicId) {
      await deleteImageFromCLoudinary(club.logoPublicId);
    }

    await db
      .update(clubs)
      .set({
        logoUrl: null,
        logoPublicId: null,
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, clubId));

    return {
      success: true,
      message: "Logo deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function getClubEvents(clubId: number) {
  try {
    const clubExists = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
      columns: { id: true },
    });

    if (!clubExists) {
      throw new Error("Club not found");
    }

    const clubEvents = await db.query.events.findMany({
      where: and(
        eq(events.clubId, clubId),
        or(isNull(events.status), eq(events.status, "cancelled")),
      ),
      orderBy: [desc(events.eventStartTime)],
    });

    if (clubEvents.length === 0) {
      return {
        success: true,
        message: "No events yet",
        clubEvents: [],
      };
    }

    return {
      success: true,
      clubEvents: clubEvents.map((event) => ({
        ...event,
        status: deriveEventStatus(event),
      })),
      message: "successful",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function getUpcomingevents() {
  try {
    const now = new Date();

    const upcomingEvents = await db.query.events.findMany({
      where: and(
        isNull(events.status),
        sql`${events.eventStartTime} > ${now} `,
        eq(events.isRegistrationOpen, true),
      ),
      with: {
        club: {
          columns: {
            name: true,
            logoUrl: true,
            id: true,
          },
        },
      },
      orderBy: [events.eventStartTime],
      limit: 20,
    });

    if (upcomingEvents.length === 0) {
      return {
        success: true,
        message: "No events yet",
        upcomingEvents: [],
      };
    }

    return {
      success: true,
      upcomingEvents: upcomingEvents.map((event) => ({
        ...event,
        status: deriveEventStatus(event),
      })),
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

export async function getAllEvents() {
  try {
    const allEvents = await db.query.events.findMany({
      where: or(isNull(events.status), eq(events.status, "cancelled")),
      with: {
        club: {
          columns: {
            name: true,
            logoUrl: true,
            id: true, // needed for links
          },
        },
      },
      orderBy: [desc(events.eventStartTime)],
      limit: 100,
    });

    if (allEvents.length === 0) {
      return {
        success: true,
        message: "No events found",
        allEvents: [],
      };
    }

    return {
      success: true,
      allEvents: allEvents.map((event) => ({
        ...event,
        status: deriveEventStatus(event),
      })),
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

export async function updateEventBannerToDb(
  eventId: number,
  bannerUrl: string,
  bannerPublicId: string | null,
) {
  await db
    .update(events)
    .set({
      bannerUrl,
      bannerPublicId,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));
}

async function getEventBannerInfo(eventId: number) {
  const [event] = await db
    .select({
      bannerUrl: events.bannerUrl,
      bannerPublicId: events.bannerPublicId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return event;
}

export async function handleEventBannerUrlUpload(
  eventId: number,
  imageUrl: string,
) {
  try {
    if (!imageUrl || typeof imageUrl !== "string") {
      return {
        success: false,
        message: "Image URL is required",
      };
    }

    if (!isValidImageUrl(imageUrl)) {
      return {
        success: false,
        message: "Invalid image URL format",
      };
    }

    const currentBanner = await getEventBannerInfo(eventId);

    if (currentBanner?.bannerPublicId) {
      await deleteImageFromCLoudinary(currentBanner.bannerPublicId);
    }

    await updateEventBannerToDb(eventId, imageUrl, null);

    return {
      success: true,
      data: {
        url: imageUrl,
        publicId: null,
        source: "external",
      },
    };
  } catch (error: any) {
    console.error("Event banner URL upload error:", error);

    return {
      success: false,
      message: error.message || "Failed to save URL",
    };
  }
}

export async function handleEventBannerFileUpload(
  eventId: number,
  file: Express.Multer.File,
) {
  try {
    if (!ALLOWED_TYPES.includes(file.mimetype as any)) {
      return {
        success: false,
        message: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        message: "File too large. Maximum size is 5MB",
      };
    }

    const currentBanner = await getEventBannerInfo(eventId);

    if (currentBanner?.bannerPublicId) {
      await deleteImageFromCLoudinary(currentBanner.bannerPublicId);
    }

    const buffer = file.buffer;
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    const uploadResult = await uploadEventBanner(eventId, dataUri);

    if (!uploadResult.success || !uploadResult.url) {
      return {
        success: false,
        message: uploadResult.message || "Upload failed",
      };
    }

    await updateEventBannerToDb(
      eventId,
      uploadResult.url,
      uploadResult.publicId || null,
    );

    return {
      success: true,
      data: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        source: "cloudinary",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "upload failed",
    };
  }
}

export async function cancelEvent(authId: string, eventId: number) {
  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        club: true,
      },
    });

    if (!event) {
      return { success: false, message: "Event not found" };
    }

    const club = unwrapOne(event.club);
    if (!club) {
      return { success: false, message: "Club not found for this event" };
    }

    const isPrimaryOwner = club.authClubId === authId;

    const adminEntry = await db.query.clubAdmins.findFirst({
      where: and(
        eq(clubAdmins.clubId, event.clubId),
        eq(clubAdmins.userId, authId),
      ),
    });

    if (!isPrimaryOwner && !adminEntry) {
      return {
        success: false,
        message: "Unauthorized: Only club owners or admins can cancel events",
      };
    }

    if (event.status === "cancelled") {
      return { success: false, message: "Event is already cancelled" };
    }
    if (deriveEventStatus(event) === "completed") {
      return { success: false, message: "Cannot cancel a completed event" };
    }

    await db
      .update(events)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    const registrations = await db.query.eventRegistrations.findMany({
      where: and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, "registered"),
      ),
      columns: { userId: true },
    });

    const notificationPayload = {
      title: "Event Cancelled",
      body: `"${event.title}" has been cancelled by the organizers.`,
      data: {
        eventId: eventId.toString(),
        clubId: event.clubId?.toString() ?? "",
        publisherId: authId,
        eventTitle: event.title,
        type: "event_cancelled",
        iconKey: "event",
        ...(event.bannerUrl ? { thumbnailUrl: event.bannerUrl } : {}),
      },
    };

    // Send in-app notifications
    await createInAppNotificationsForUsers({
      userIds: registrations.map((item) => item.userId),
      type: "event_cancelled",
      title: notificationPayload.title,
      body: notificationPayload.body,
      data: notificationPayload.data,
    });

    // Send FCM push notifications to each registered user
    // Await all promises to ensure reliability in serverless
    await Promise.all(
      registrations.map((reg) => sendToUser(reg.userId, notificationPayload)),
    );

    return {
      success: true,
      message: "Event cancelled successfully",
    };
  } catch (error: any) {
    console.error("Cancel event error:", error);
    return {
      success: false,
      message: error.message || "Failed to cancel event",
    };
  }
}
