import { db } from "../lib/db.js";
import { and, desc, eq, ilike, or, sql, asc, gte, lte } from "drizzle-orm";
import { bookListings, bookImages, bookCategories, savedBooks } from "../models/book_buy_sell-schema.js";
import { sendToTopic } from "./notification.service.js";


export interface CreateListingData {
    title: string;
    author: string;
    isbn?: string;
    edition?: string;
    publisher?: string;
    publicationYear?: number;
    condition: "new" | "like_new" | "good" | "fair" | "poor";
    description?: string;
    price: string;
    courseCode?: string;
    categoryId?: number;
}

export interface ListingFilters {
    search?: string;
    author?: string;
    isbn?: string;
    categoryId?: number;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    sortBy?: "price_asc" | "price_desc" | "newest" | "oldest";
    page?: number;
    limit?: number;
}

export const createBookListing = async (
    sellerId: string,
    data: CreateListingData
) => {
    try {

        if (data.categoryId) {
            const category = await db.query.bookCategories.findFirst({
                where: eq(bookCategories.id, data.categoryId),
            });
            if (!category) {
                return {
                    success: false,
                    message: "Category not found.",
                };
            }
        }

        const [listing] = await db
            .insert(bookListings)
            .values({
                sellerId,
                title: data.title,
                author: data.author,
                isbn: data.isbn,
                edition: data.edition,
                publisher: data.publisher,
                publicationYear: data.publicationYear,
                condition: data.condition,
                description: data.description,
                price: data.price,
                courseCode: data.courseCode,
                categoryId: data.categoryId,
                status: "available",
            })
            .returning();

        // Trigger notification (non-blocking)
        sendToTopic('books', {
            title: 'New Book Listed!',
            body: `${data.title} is now available for ${data.price} NPR.`,
            data: {
                type: 'new_book',
                bookId: listing.id.toString(),
            }
        }).catch(err => console.error('Failed to send book notification:', err));

        return {
            success: true,
            data: listing,
            message: "Book listing created successfully.",
        };
    } catch (error) {
        console.error("Error creating book listing:", error);
        return {
            success: false,
            message: "Failed to create book listing.",
        };
    }
};

export const getBookListings = async (filters: ListingFilters = {}) => {
    try {
        const {
            search,
            author,
            isbn,
            categoryId,
            condition,
            minPrice,
            maxPrice,
            status = "available",
            sortBy = "newest",
            page = 1,
            limit = 20,
        } = filters;

        const conditions = [];


        if (status) {
            conditions.push(eq(bookListings.status, status as any));
        }


        if (search) {
            conditions.push(
                or(
                    ilike(bookListings.title, `%${search}%`),
                    ilike(bookListings.author, `%${search}%`),
                    ilike(bookListings.isbn, `%${search}%`)
                )
            );
        }


        if (author) {
            conditions.push(ilike(bookListings.author, `%${author}%`));
        }


        if (isbn) {
            conditions.push(ilike(bookListings.isbn, `%${isbn}%`));
        }


        if (categoryId) {
            conditions.push(eq(bookListings.categoryId, categoryId));
        }


        if (condition) {
            conditions.push(eq(bookListings.condition, condition as any));
        }


        if (minPrice !== undefined) {
            conditions.push(gte(bookListings.price, minPrice.toString()));
        }
        if (maxPrice !== undefined) {
            conditions.push(lte(bookListings.price, maxPrice.toString()));
        }


        let orderBy;
        switch (sortBy) {
            case "price_asc":
                orderBy = asc(bookListings.price);
                break;
            case "price_desc":
                orderBy = desc(bookListings.price);
                break;
            case "oldest":
                orderBy = asc(bookListings.createdAt);
                break;
            case "newest":
            default:
                orderBy = desc(bookListings.createdAt);
        }

        const offset = (page - 1) * limit;

        const listings = await db.query.bookListings.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            orderBy: [orderBy],
            limit,
            offset,
            with: {
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                images: {
                    limit: 1,
                },
                category: true,
            },
        });


        const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(bookListings)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        const totalCount = countResult[0]?.count || 0;

        return {
            success: true,
            data: {
                listings,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            },
        };
    } catch (error) {
        console.error("Error fetching book listings:", error);
        return {
            success: false,
            message: "Failed to fetch book listings.",
        };
    }
};

export const getBookListingById = async (id: number, userId?: string) => {
    try {
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, id),
            with: {
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                images: true,
                category: true,
            },
        });

        if (!listing) {
            return {
                success: false,
                message: "Book listing not found.",
            };
        }


        let isSaved = false;
        if (userId) {
            const saved = await db.query.savedBooks.findFirst({
                where: and(
                    eq(savedBooks.userId, userId),
                    eq(savedBooks.listingId, id)
                ),
            });
            isSaved = !!saved;
        }


        db.update(bookListings)
            .set({ viewCount: sql`${bookListings.viewCount} + 1` })
            .where(eq(bookListings.id, id))
            .catch(console.error);

        return {
            success: true,
            data: {
                ...listing,
                isSaved,
                isOwner: userId === listing.sellerId,
            },
        };
    } catch (error) {
        console.error("Error fetching book listing:", error);
        return {
            success: false,
            message: "Failed to fetch book listing.",
        };
    }
};

export const updateBookListing = async (
    id: number,
    sellerId: string,
    data: Partial<CreateListingData>
) => {
    try {

        const existing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, id),
        });

        if (!existing) {
            return {
                success: false,
                message: "Book listing not found.",
            };
        }

        if (existing.sellerId !== sellerId) {
            return {
                success: false,
                message: "You are not authorized to update this listing.",
            };
        }


        if (data.categoryId) {
            const category = await db.query.bookCategories.findFirst({
                where: eq(bookCategories.id, data.categoryId),
            });
            if (!category) {
                return {
                    success: false,
                    message: "Category not found.",
                };
            }
        }

        const [updated] = await db
            .update(bookListings)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(bookListings.id, id))
            .returning();

        return {
            success: true,
            data: updated,
            message: "Book listing updated successfully.",
        };
    } catch (error) {
        console.error("Error updating book listing:", error);
        return {
            success: false,
            message: "Failed to update book listing.",
        };
    }
};

export const deleteBookListing = async (id: number, sellerId: string) => {
    try {

        const existing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, id),
        });

        if (!existing) {
            return {
                success: false,
                message: "Book listing not found.",
            };
        }

        if (existing.sellerId !== sellerId) {
            return {
                success: false,
                message: "You are not authorized to delete this listing.",
            };
        }


        await db.delete(bookImages).where(eq(bookImages.listingId, id));


        await db.delete(savedBooks).where(eq(savedBooks.listingId, id));


        await db.delete(bookListings).where(eq(bookListings.id, id));

        return {
            success: true,
            message: "Book listing deleted successfully.",
        };
    } catch (error) {
        console.error("Error deleting book listing:", error);
        return {
            success: false,
            message: "Failed to delete book listing.",
        };
    }
};

export const getMyListings = async (sellerId: string) => {
    try {
        const listings = await db.query.bookListings.findMany({
            where: eq(bookListings.sellerId, sellerId),
            orderBy: desc(bookListings.createdAt),
            with: {
                images: {
                    limit: 1,
                },
                category: true,
            },
        });

        return {
            success: true,
            data: listings,
        };
    } catch (error) {
        console.error("Error fetching user's listings:", error);
        return {
            success: false,
            message: "Failed to fetch your listings.",
        };
    }
};

export const markAsSold = async (id: number, sellerId: string) => {
    try {

        const existing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, id),
        });

        if (!existing) {
            return {
                success: false,
                message: "Book listing not found.",
            };
        }

        if (existing.sellerId !== sellerId) {
            return {
                success: false,
                message: "You are not authorized to update this listing.",
            };
        }

        const [updated] = await db
            .update(bookListings)
            .set({
                status: "sold",
                soldAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(bookListings.id, id))
            .returning();

        return {
            success: true,
            data: updated,
            message: "Book marked as sold.",
        };
    } catch (error) {
        console.error("Error marking book as sold:", error);
        return {
            success: false,
            message: "Failed to mark book as sold.",
        };
    }
};

export const addBookImage = async (
    listingId: number,
    sellerId: string,
    imageUrl: string,
    imagePublicId?: string
) => {
    try {

        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return {
                success: false,
                message: "Book listing not found.",
            };
        }

        if (listing.sellerId !== sellerId) {
            return {
                success: false,
                message: "You are not authorized to add images to this listing.",
            };
        }

        const [image] = await db
            .insert(bookImages)
            .values({
                listingId,
                imageUrl,
                imagePublicId,
            })
            .returning();

        return {
            success: true,
            data: image,
            message: "Image added successfully.",
        };
    } catch (error) {
        console.error("Error adding book image:", error);
        return {
            success: false,
            message: "Failed to add image.",
        };
    }
};

export const deleteBookImage = async (
    imageId: number,
    sellerId: string
) => {
    try {

        const image = await db.query.bookImages.findFirst({
            where: eq(bookImages.id, imageId),
            with: {
                listing: true,
            },
        });

        if (!image) {
            return {
                success: false,
                message: "Image not found.",
            };
        }


        await db.delete(bookImages).where(eq(bookImages.id, imageId));

        return {
            success: true,
            data: { publicId: image.imagePublicId },
            message: "Image deleted successfully.",
        };
    } catch (error) {
        console.error("Error deleting book image:", error);
        return {
            success: false,
            message: "Failed to delete image.",
        };
    }
};
