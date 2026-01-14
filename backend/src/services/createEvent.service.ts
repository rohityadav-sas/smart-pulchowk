import { CreateEventInput } from "../types/events.js";
import { db } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { clubs, events, clubAdmins } from "../models/event-schema.js";



export async function createEvent(userId: string, clubId: number, eventInput: CreateEventInput) {

    console.log('eventInput:', JSON.stringify(eventInput, null, 2));

    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
            columns: {
                id: true,
                isActive: true,
                authClubId: true
            }
        });

        if (!club) {
            throw new Error('Club not found in system');
        }

        if (!club.isActive) {
            throw new Error('Club is not active');
        }

        // Check authorization
        let isAuthorized = club.authClubId === userId;

        if (!isAuthorized) {
            const admin = await db.query.clubAdmins.findFirst({
                where: and(
                    eq(clubAdmins.clubId, clubId),
                    eq(clubAdmins.userId, userId)
                )
            });
            if (admin) isAuthorized = true;
        }

        if (!isAuthorized) {
            throw new Error('Unauthorized to create events for this club');
        }

        let eventStartTime: Date;
        let eventEndTime: Date;
        let registrationDeadline: Date;

        try {
            eventStartTime = new Date(eventInput.eventStartTime);
            eventEndTime = new Date(eventInput.eventEndTime);
            registrationDeadline = new Date(eventInput.registrationDeadline);
        } catch (err) {
            console.error('Date parsing error:', err);
            throw new Error('Failed to parse dates');
        }

        if (isNaN(eventStartTime.getTime()) || isNaN(eventEndTime.getTime()) || isNaN(registrationDeadline.getTime())) {
            throw new Error('Invalid date format received from client');
        }


        if (eventStartTime >= eventEndTime) {
            throw new Error('Event end time must be after start time');
        }

        if (registrationDeadline >= eventStartTime) {
            throw new Error('Registration deadline must be before event start time');
        }


        const insertData = {
            clubId: club.id,
            title: eventInput.title,
            description: eventInput.description,
            eventType: eventInput.eventType,
            venue: eventInput.venue,
            maxParticipants: eventInput.maxParticipants,
            registrationDeadline: registrationDeadline,
            eventStartTime: eventStartTime,
            eventEndTime: eventEndTime,
            bannerUrl: eventInput.bannerUrl || null,
            status: 'draft' as const,
        };

        const [event] = await db.insert(events).values(insertData).returning();

        console.log('Event created successfully:', event);

        return {
            success: true,
            event,
            message: 'Event created successfully',
        };

    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to create event'
        };
    }
}