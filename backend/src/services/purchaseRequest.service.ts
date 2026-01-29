import { db } from "../lib/db.js";
import { eq, and, desc } from "drizzle-orm";
import { bookPurchaseRequests, bookListings } from "../models/book_buy_sell-schema.js";
import { sendToUser } from "./notification.service.js";

export const createPurchaseRequest = async (
    listingId: number,
    buyerId: string,
    message?: string
) => {
    try {

        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        if (listing.sellerId === buyerId) {
            return { success: false, message: "You cannot request to buy your own book." };
        }

        if (listing.status !== "available") {
            return { success: false, message: "This book is no longer available." };
        }


        const existing = await db.query.bookPurchaseRequests.findFirst({
            where: and(
                eq(bookPurchaseRequests.listingId, listingId),
                eq(bookPurchaseRequests.buyerId, buyerId)
            ),
        });

        if (existing) {
            return {
                success: false,
                message: existing.status === "rejected"
                    ? "Your previous request was rejected."
                    : "You have already requested this book.",
                existingStatus: existing.status
            };
        }


        const [request] = await db
            .insert(bookPurchaseRequests)
            .values({
                listingId,
                buyerId,
                message,
            })
            .returning();

        // Notify seller (non-blocking)
        sendToUser(listing.sellerId, {
            title: 'New Purchase Request!',
            body: `Someone is interested in your book: ${listing.title}.`,
            data: {
                type: 'purchase_request',
                listingId: listingId.toString(),
                requestId: request.id.toString(),
            }
        }).catch(err => console.error('Failed to notify seller of purchase request:', err));

        return { success: true, data: request, message: "Request sent successfully!" };
    } catch (error) {
        console.error("Error creating purchase request:", error);
        return { success: false, message: "Failed to send request." };
    }
};

export const getPurchaseRequestsForListing = async (
    listingId: number,
    sellerId: string
) => {
    try {

        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        if (listing.sellerId !== sellerId) {
            return { success: false, message: "You are not authorized to view these requests." };
        }

        const requests = await db.query.bookPurchaseRequests.findMany({
            where: eq(bookPurchaseRequests.listingId, listingId),
            with: {
                buyer: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
            orderBy: desc(bookPurchaseRequests.createdAt),
        });

        return { success: true, data: requests };
    } catch (error) {
        console.error("Error getting purchase requests:", error);
        return { success: false, message: "Failed to get requests." };
    }
};

export const getMyPurchaseRequests = async (buyerId: string) => {
    try {
        const requests = await db.query.bookPurchaseRequests.findMany({
            where: eq(bookPurchaseRequests.buyerId, buyerId),
            with: {
                listing: {
                    with: {
                        images: { limit: 1 },
                        seller: {
                            columns: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
            },
            orderBy: desc(bookPurchaseRequests.createdAt),
        });

        return { success: true, data: requests };
    } catch (error) {
        console.error("Error getting my purchase requests:", error);
        return { success: false, message: "Failed to get your requests." };
    }
};

export const respondToPurchaseRequest = async (
    requestId: number,
    sellerId: string,
    accept: boolean
) => {
    try {

        const request = await db.query.bookPurchaseRequests.findFirst({
            where: eq(bookPurchaseRequests.id, requestId),
            with: {
                listing: true,
            },
        });

        if (!request) {
            return { success: false, message: "Request not found." };
        }

        if (request.listing.sellerId !== sellerId) {
            return { success: false, message: "You are not authorized to respond to this request." };
        }

        if (request.status !== "requested") {
            return { success: false, message: "This request has already been responded to." };
        }

        const newStatus = accept ? "accepted" : "rejected";

        const [updated] = await db
            .update(bookPurchaseRequests)
            .set({
                status: newStatus,
                respondedAt: new Date(),
            })
            .where(eq(bookPurchaseRequests.id, requestId))
            .returning();

        // Notify buyer (non-blocking)
        sendToUser(request.buyerId, {
            title: accept ? 'Request Accepted!' : 'Request Rejected',
            body: accept
                ? `Your request for "${request.listing.title}" was accepted! You can now see the seller's contact info.`
                : `Your request for "${request.listing.title}" was rejected.`,
            data: {
                type: 'request_response',
                listingId: request.listingId.toString(),
                status: newStatus,
            }
        }).catch(err => console.error('Failed to notify buyer of request response:', err));

        return {
            success: true,
            data: updated,
            message: accept ? "Request accepted! Buyer can now see your contact info." : "Request rejected."
        };
    } catch (error) {
        console.error("Error responding to purchase request:", error);
        return { success: false, message: "Failed to respond to request." };
    }
};

export const getPurchaseRequestStatus = async (listingId: number, buyerId: string) => {
    try {
        const request = await db.query.bookPurchaseRequests.findFirst({
            where: and(
                eq(bookPurchaseRequests.listingId, listingId),
                eq(bookPurchaseRequests.buyerId, buyerId)
            ),
        });

        return { success: true, data: request || null };
    } catch (error) {
        console.error("Error getting purchase request status:", error);
        return { success: false, message: "Failed to get request status." };
    }
};

export const cancelPurchaseRequest = async (requestId: number, buyerId: string) => {
    try {
        const request = await db.query.bookPurchaseRequests.findFirst({
            where: eq(bookPurchaseRequests.id, requestId),
        });

        if (!request) {
            return { success: false, message: "Request not found." };
        }

        if (request.buyerId !== buyerId) {
            return { success: false, message: "You are not authorized to cancel this request." };
        }

        if (request.status !== "requested") {
            return { success: false, message: "Only pending requests can be cancelled." };
        }

        await db.delete(bookPurchaseRequests).where(eq(bookPurchaseRequests.id, requestId));

        return { success: true, message: "Request cancelled." };
    } catch (error) {
        console.error("Error cancelling purchase request:", error);
        return { success: false, message: "Failed to cancel request." };
    }
};
