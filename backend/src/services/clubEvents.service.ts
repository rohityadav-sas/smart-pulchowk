import { createClubInput } from "../types/events.js";
import { db } from "../lib/db.js";
import { clubs, events, clubAdmins } from "../models/event-schema.js"; // updated import
import { desc, eq, sql, and, or, asc } from "drizzle-orm"; // updated imports
import { user } from "../models/auth-schema.js";

export async function addClubAdmin(ownerId: string, clubId: number, newAdminEmail: string) {
    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId)
        });

        if (!club) throw new Error("Club not found");
        if (club.authClubId !== ownerId) throw new Error("Only the owner can add admins");

        const targetUser = await db.query.user.findFirst({
            where: eq(user.email, newAdminEmail)
        });

        if (!targetUser) throw new Error("User with this email not found");

        await db.insert(clubAdmins).values({
            clubId,
            userId: targetUser.id,
            role: 'admin'
        });

        return { success: true, message: "Admin added successfully" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function removeClubAdmin(ownerId: string, clubId: number, adminUserId: string) {
    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId)
        });

        if (!club) throw new Error("Club not found");
        if (club.authClubId !== ownerId) throw new Error("Only the owner can remove admins");

        await db.delete(clubAdmins).where(
            and(
                eq(clubAdmins.clubId, clubId),
                eq(clubAdmins.userId, adminUserId)
            )
        );

        return { success: true, message: "Admin removed successfully" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function getClubAdmins(clubId: number) {
    try {
        const admins = await db.select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
        })
            .from(clubAdmins)
            .innerJoin(user, eq(clubAdmins.userId, user.id))
            .where(eq(clubAdmins.clubId, clubId));

        return { success: true, admins };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function createClub(authClubId: string, clubData: createClubInput) {
    try {
        if (!clubData) {
            throw Error('Request body is missing');
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
            throw new Error("Club with this name already exists")
        }

        const [newclub] = await db.insert(clubs).values({
            authClubId: authClubId,
            name: clubData.name,
            description: clubData.description,
            email: clubData.email,
            logoUrl: clubData.logoUrl,
            isActive: true,
        }).returning();

        return {
            success: true,
            club: newclub,
            message: 'Club creatd successfully',
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function getClubs() {
    try {
        const existingClub = await db.query.clubs.findMany({
            where: eq(clubs.isActive, true),
            orderBy: [asc(clubs.name)],
            columns: {
                id: true,
                authClubId: true,
                name: true,
                description: true,
                logoUrl: true,
            },
        });

        return {
            success: true,
            existingClub
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function updateClubInfo(clubId: number, clubData: createClubInput){
    try{
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
        });

        if(!club){
            return {
                success: false,
                message: "No clubs found!!"
            }
        }

        const updatedClub = await db
            .update(clubs)
            .set({
                ...clubData, 
                updatedAt: new Date(),
            })
            .where(eq(clubs.id, clubId))
            .returning();
        
        return {
            success: true,
            message: "club Updated successfully",
            data: updatedClub
        };
        
    }catch(error){
        console.error(error.messsage);
        return {
            success: false, 
            message: error.message || "Failed to update the club Info"
        }
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
                upcomingEvents: sql <number>`
                    COUNT(DISTINCT CASE
                    WHEN ${events.status} = 'published' 
                    AND ${events.eventStartTime} > NOW()
                    THEN ${events.id}
                    END)`,
                completedEvents: sql<number>`
        COUNT(DISTINCT CASE 
          WHEN ${events.status} = 'completed' 
          THEN ${events.id} 
        END)
      `,
                totalParticipants: sql<number>`
        COALESCE(SUM(${events.currentParticipants}), 0)
      `,
            }).from(clubs)
            .leftJoin(events, eq(events.clubId, clubs.id))
            .where(and(
                eq(clubs.id, clubId),
                eq(clubs.isActive, true)
            ))
            .groupBy(clubs.id)

        if (!clubData) {
            return null;
        }

        return {
            success: true,
            clubData
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}


export async function getClubEvents(clubId: number) {

    try {
        const clubExists = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
            columns: { id: true }
        });

        if (!clubExists) {
            throw new Error('Club not found');
        }

        const clubEvents = await db.query.events.findMany({
            where: eq(events.clubId, clubId),
            orderBy: [desc(events.eventStartTime)]
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
            clubEvents,
            message: "successful"
        }

    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function getUpcomingevents() {
    try {
        const now = new Date();

        const upcomingEvents = await db.query.events.findMany({
            where: and(
                eq(events.status, 'published'),
                sql`${events.eventStartTime} > ${now}`,
                eq(events.isRegistrationOpen, true)
            ),
            with: {
                club: {
                    columns: {
                        name: true,
                        logoUrl: true,
                        id: true
                    }
                },
            },
            orderBy: [events.eventStartTime],
            limit: 20
        });

        if (upcomingEvents.length === 0) {
            return {
                success: true,
                message: "No events yet",
                upcomingEvents: [],
            }
        }

        return {
            success: true,
            upcomingEvents
        }
    } catch (error) {
        return {
            success: false,
            message: (error as Error).message
        }
    }
}

export async function getAllEvents() {
    try {
        const allEvents = await db.query.events.findMany({
            with: {
                club: {
                    columns: {
                        name: true,
                        logoUrl: true,
                        id: true // needed for links 
                    }
                },
            },
            orderBy: [desc(events.eventStartTime)],
            limit: 100
        });

        if (allEvents.length === 0) {
            return {
                success: true,
                message: "No events found",
                allEvents: [],
            }
        }

        return {
            success: true,
            allEvents
        }
    } catch (error) {
        return {
            success: false,
            message: (error as Error).message
        }
    }
}