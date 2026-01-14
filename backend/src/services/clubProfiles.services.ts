import { CreateClubProfileInput, CreateEventDetailsInput } from "../types/events.ts";
import { db } from "../lib/db.ts";
import { clubs, clubProfiles } from "../models/event-schema.ts";
import { eq } from "drizzle-orm";
import { events, aboutEvents } from "../models/event-schema.ts";

export async function createClubProfile(clubId: number, profileData: CreateClubProfileInput) {
    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
            columns: { id: true, isActive: true }
        });

        if (!club) {
            throw new Error('Club not found');
        }

        if (!club.isActive) {
            throw new Error("Club is not active");
        }

        const [newProfile] = await db.insert(clubProfiles).values({
            clubId,
            aboutClub: profileData.aboutClub,
            mission: profileData.mission,
            vision: profileData.vision,
            achievements: profileData.achievements,
            benefits: profileData.benefits,
            contactPhone: profileData.contactPhone,
            websiteUrl: profileData.websiteUrl,
            socialLinks: profileData.socialLinks,
            establishedYear: profileData.establishedYear,
            totalEventHosted: 0
        }).returning();

        return {
            success: true,
            profile: newProfile,
            message: 'Club profile created successfully'
        };
    } catch (error) {
        console.error('Error creating profile:', error);
        return {
            success: false,
            message: error.message || 'Failed to create club profile'
        }
    }
}

export async function updateClubProfile(clubId: number, profileData: CreateClubProfileInput) {
    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
            columns: { id: true, isActive: true }
        });

        if (!club) {
            throw new Error("Club not found");
        }

        const existingProfile = await db.query.clubProfiles.findFirst({
            where: eq(clubProfiles.clubId, clubId)
        });

        if (!existingProfile) {
            throw new Error('Club profile not found. Create one first.');
        }

        const [updatedProfile] = await db
            .update(clubProfiles)
            .set({
                aboutClub: profileData.aboutClub,
                mission: profileData.mission,
                vision: profileData.vision,
                achievements: profileData.achievements,
                benefits: profileData.benefits,
                contactPhone: profileData.contactPhone,
                websiteUrl: profileData.websiteUrl,
                socialLinks: profileData.socialLinks,
                establishedYear: profileData.establishedYear,
                updatedAt: new Date()
            })
            .where(eq(clubProfiles.clubId, clubId))
            .returning();

        return {
            success: true,
            profile: updatedProfile,
            message: "Club profile updated successfully"
        };
    } catch (error) {
        console.error('Error Updating club profile:', error);
        return {
            success: false,
            message: error.message || "Failed to Update club profile"
        };
    }
}

export async function getClubProfile(clubId: number) {
    try {
        const profile = await db.query.clubProfiles
            .findFirst({
                where: eq(clubProfiles.clubId, clubId),
                with: {
                    club: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            description: true,
                            createdAt: true,
                        }
                    }
                }
            });

        if (!profile) {
            return {
                success: true,
                profile: null,
                message: 'No profile found for this club'
            };
        }

        return {
            success: true,
            profile
        };
    } catch (error) {
        console.error("Error fetching club profile:", error);
        return {
            success: false,
            message: error.message || "Failed to fetch club profile"
        };
    }
}

export async function createExtraEventDetails(eventId: number, detailsData: CreateEventDetailsInput) {
    try {
        const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
            columns: { id: true }
        });

        if (!event) {
            throw new Error('Event not found');
        }

        const [result] = await db
            .insert(aboutEvents)
            .values({
                eventId,
                fullDescription: detailsData.fullDescription,
                objectives: detailsData.objectives,
                targetAudience: detailsData.targetAudience,
                prerequisites: detailsData.prerequisites,
                rules: detailsData.rules,
                judgingCriteria: detailsData.judgingCriteria,
            }).returning();

        return {
            success: true,
            details: result,
            message: "Event details created successfully"
        };
    } catch (error) {
        console.error("Error creating event details:", error);
        return {
            success: false,
            message: error.message || "Failed to save event details"
        };
    }
}

export async function getExtraEventDetails(eventId: number) {
    try {
        const details = await db
            .query
            .aboutEvents
            .findFirst({
                where: eq(aboutEvents.eventId, eventId)
            });

        if (!details) {
            return {
                success: true,
                details: null,
                message: "No additional details found for this event"
            };
        }

        return {
            success: true,
            details
        };

    } catch (error) {
        console.error("Error fetching event details: ", error);
        return {
            success: false,
            message: error.message || "Failed to fetch event details"
        }
    }
}

export async function updateExtraEventDetail(eventId: number, detailsData: CreateEventDetailsInput) {
    try {
        const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
            columns: { id: true }
        });

        if (!event) {
            throw new Error('Event not found');
        }

        const [result] = await db
            .update(aboutEvents)
            .set({
                ...detailsData,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(aboutEvents.eventId, eventId))
            .returning();

        return {
            success: true,
            details: result,
            message: "Event details created successfully"
        };
    } catch (error) {
        console.error("Error updating  event details:", error);
        return {
            success: false,
            message: error.message || "Failed to save event details"
        };
    }
}