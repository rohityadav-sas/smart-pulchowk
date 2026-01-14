import { db } from "../lib/db.ts";
import { clubs, eventCategories } from "../models/event-schema.ts";
import { eq } from "drizzle-orm";
import { CreateEventCategoryInput } from "../types/events.ts";


export async function createEventCategory(clubId: number, data: CreateEventCategoryInput) {
    try {
        const club = await db.query.clubs.findFirst({
            where: eq(clubs.id, clubId),
            columns: { id: true, isActive: true }
        });

        if (!club) {
            throw new Error('Club not found');
        }

        if (!club.isActive) {
            throw new Error('Club is not active');
        }

        const [newCategory] = await db.insert(eventCategories).values({
            clubId,
            name: data.name,
            description: data.description,
            objectives: data.objectives,
            targetAudience: data.targetAudience,
            prerequisites: data.prerequisites,
            rules: data.rules,
            judgingCriteria: data.judgingCriteria,
            bannerUrl: data.bannerUrl,
        }).returning();

        return {
            success: true,
            category: newCategory,
            message: 'Event category created successfully'
        };
    } catch (error: any) {
        console.error('Error creating event category:', error);
        return {
            success: false,
            message: error.message || 'Failed to create event category'
        };
    }
}

export async function updateEventCategory(categoryId: number, data: Partial<CreateEventCategoryInput>) {
    try {
        const existing = await db.query.eventCategories.findFirst({
            where: eq(eventCategories.id, categoryId)
        });

        if (!existing) {
            throw new Error('Event category not found');
        }

        const [updated] = await db
            .update(eventCategories)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(eventCategories.id, categoryId))
            .returning();

        return {
            success: true,
            category: updated,
            message: 'Event category updated successfully'
        };
    } catch (error: any) {
        console.error('Error updating event category:', error);
        return {
            success: false,
            message: error.message || 'Failed to update event category'
        };
    }
}

export async function getEventCategories(clubId: number) {
    try {
        const categories = await db.query.eventCategories.findMany({
            where: eq(eventCategories.clubId, clubId),
            orderBy: (categories, { desc }) => [desc(categories.createdAt)]
        });

        return {
            success: true,
            categories
        };
    } catch (error: any) {
        console.error('Error fetching event categories:', error);
        return {
            success: false,
            categories: [],
            message: error.message || 'Failed to fetch event categories'
        };
    }
}

export async function getEventCategory(categoryId: number) {
    try {
        const category = await db.query.eventCategories.findFirst({
            where: eq(eventCategories.id, categoryId),
            with: {
                club: {
                    columns: {
                        id: true,
                        name: true,
                        logoUrl: true
                    }
                }
            }
        });

        if (!category) {
            return {
                success: true,
                category: null,
                message: 'Event category not found'
            };
        }

        return {
            success: true,
            category
        };
    } catch (error: any) {
        console.error('Error fetching event category:', error);
        return {
            success: false,
            category: null,
            message: error.message || 'Failed to fetch event category'
        };
    }
}

export async function deleteEventCategory(categoryId: number) {
    try {
        const existing = await db.query.eventCategories.findFirst({
            where: eq(eventCategories.id, categoryId)
        });

        if (!existing) {
            throw new Error('Event category not found');
        }

        await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));

        return {
            success: true,
            message: 'Event category deleted successfully'
        };
    } catch (error: any) {
        console.error('Error deleting event category:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete event category'
        };
    }
}
