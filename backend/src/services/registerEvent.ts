import { db } from "../lib/db.js";
import { eq, sql, desc, and, asc } from "drizzle-orm";
import { eventRegistrations, events } from "../models/event-schema.js";
import { unwrapOne } from "../lib/type-utils.js";
import { createInAppNotificationForUser } from "./inAppNotification.service.js";

export async function registerStudentForEvent(userId: string, eventId: number) {
    try {
        const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
            columns: {
                id: true,
                isRegistrationOpen: true,
                maxParticipants: true,
                currentParticipants: true,
                registrationDeadline: true,
                clubId: true,
                bannerUrl: true,
            }
        })

        if (!event) {
            throw new Error('Event not found');
        }

        if (!event.isRegistrationOpen) {
            throw new Error('Registration is closed for this event');
        }

        if (event.maxParticipants && event.currentParticipants >= event.maxParticipants) {
            throw new Error('Event is full');
        }

        if (event.registrationDeadline && new Date() > event.registrationDeadline) {
            throw new Error('Registration deadline has passed');
        }

        const existingRegistration = await db.query.eventRegistrations.findFirst({
            where: and(
                eq(eventRegistrations.userId, userId),
                eq(eventRegistrations.eventId, event.id)
            )
        });

        let registration;

        if (existingRegistration) {
            if (existingRegistration.status === "cancelled") {
                registration = await db.update(eventRegistrations)
                    .set({
                        status: "registered",
                        registeredAt: new Date(),
                        cancelledAt: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(eventRegistrations.id, existingRegistration.id))
                    .returning();
            } else {
                throw new Error('You are already registered for this event');
            }
        } else {

            registration = await db.insert(eventRegistrations).values({
                userId: userId,
                eventId: eventId,
                status: 'registered',
            }).returning();
        }

        await db.update(events)
            .set({
                currentParticipants: sql`${events.currentParticipants} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(events.id, eventId));

        createInAppNotificationForUser({
            userId,
            type: "event_registration",
            title: "Event Registration Confirmed",
            body: "You are registered for the selected event.",
            data: {
                eventId,
                clubId: event.clubId,
                iconKey: "event",
                ...(event.bannerUrl ? { thumbnailUrl: event.bannerUrl } : {}),
            },
        }).catch((error) =>
            console.error("Failed to create event registration notification:", error),
        );

        return {
            success: true,
            registration,
            message: 'Successfully registered for event',
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function getEventRegistrations(eventId: number) {
    const registrations = await db.query.eventRegistrations.findMany({
        where: eq(eventRegistrations.eventId, eventId),
        with: {
            user: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                }
            },
        },
        orderBy: [desc(eventRegistrations.registeredAt)],
    });

    const mapped = registrations.map(reg => {
        const student = unwrapOne(reg.user);
        return {
            registrationId: reg.id,
            status: reg.status,
            registeredAt: reg.registeredAt,
            attendedAt: reg.attendedAt,
            student: {
                id: student?.id,
                name: student?.name,
                email: student?.email,
                image: student?.image,
            }
        };
    });

    return {
        success: true,
        registrations: mapped,
        message: registrations.length === 0 ? "No registrations yet.." : undefined
    };
}

export async function cancelEventRegistration(userId: string, eventId: number) {
    try {
        const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
            columns: { id: true, clubId: true, bannerUrl: true },
        });

        await db.update(eventRegistrations)
            .set({
                status: 'cancelled',
                cancelledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(eventRegistrations.userId, userId),
                    eq(eventRegistrations.eventId, eventId),
                    eq(eventRegistrations.status, 'registered')
                )
            );

        await db.update(events)
            .set({
                currentParticipants: sql`Greatest(${events.currentParticipants} - 1, 0)`,
                updatedAt: new Date(),
            })
            .where(eq(events.id, eventId));

        createInAppNotificationForUser({
            userId,
            type: "event_registration_cancelled",
            title: "Event Registration Cancelled",
            body: "Your event registration has been cancelled.",
            data: {
                eventId,
                ...(event?.clubId ? { clubId: event.clubId } : {}),
                iconKey: "event",
                ...(event?.bannerUrl ? { thumbnailUrl: event.bannerUrl } : {}),
            },
        }).catch((error) =>
            console.error("Failed to create event cancellation notification:", error),
        );

        return {
            success: true,
            message: 'Registration cancelled successfully'
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function getStudentActiveRegistration(userId: string) {
    try {
        const registrations = await db.query.eventRegistrations.findMany({
            where: and(
                eq(eventRegistrations.userId, userId),
                eq(eventRegistrations.status, 'registered')
            ),
            with: {
                event: {
                    columns: {
                        id: true,
                        title: true,
                        clubId: true,
                        eventStartTime: true,
                        venue: true,
                    },
                    with: {
                        club: {
                            columns: {
                                name: true
                            }
                        },
                    },
                },
            },
        });

        if (registrations.length === 0) {
            return {
                success: true, // Changed to true so frontend doesn't error out
                message: 'No active registration found for this student',
                registrations: []
            };
        }

        return {
            success: true,
            registrations, // Return array
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        }
    }
}

export async function getEventRegistrationsForExport(eventId: number) {
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
            title: true,
        }
    });

    if (!event) {
        throw new Error("Event not found");
    }

    const registrations = await db.query.eventRegistrations.findMany({
        where: eq(eventRegistrations.eventId, eventId),
        with: {
            user: {
                columns: {
                    name: true,
                    email: true
                }
            },
        },
        orderBy: [asc(eventRegistrations.registeredAt)],
    });

    return {
        eventTitle: event.title,
        data: registrations.map(reg => {
            const student = unwrapOne(reg.user);
            return {
                Name: student?.name || "",
                Email: student?.email || "",
                Status: reg.status,
                Date: reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : 'N/A'
            };
        })
    };
}
