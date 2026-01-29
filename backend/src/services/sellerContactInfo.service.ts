import { db } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { sellerContactInfo, bookListings, bookPurchaseRequests } from "../models/book_buy_sell-schema.js";

export interface SellerContactInfoData {
    primaryContactMethod: "whatsapp" | "facebook_messenger" | "telegram" | "email" | "phone" | "other";
    whatsapp?: string;
    facebookMessenger?: string;
    telegramUsername?: string;
    email?: string;
    phoneNumber?: string;
    otherContactDetails?: string;
}

export const upsertSellerContactInfo = async (
    listingId: number,
    sellerId: string,
    data: SellerContactInfoData
) => {
    try {
        
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        if (listing.sellerId !== sellerId) {
            return { success: false, message: "You are not authorized to update this listing." };
        }

        
        const existing = await db.query.sellerContactInfo.findFirst({
            where: eq(sellerContactInfo.listingId, listingId),
        });

        if (existing) {
            
            const [updated] = await db
                .update(sellerContactInfo)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(sellerContactInfo.listingId, listingId))
                .returning();

            return { success: true, data: updated, message: "Contact info updated." };
        } else {
            
            const [inserted] = await db
                .insert(sellerContactInfo)
                .values({
                    listingId,
                    ...data,
                })
                .returning();

            return { success: true, data: inserted, message: "Contact info added." };
        }
    } catch (error) {
        console.error("Error upserting seller contact info:", error);
        return { success: false, message: "Failed to save contact info." };
    }
};

export const getSellerContactInfo = async (
    listingId: number,
    requestingUserId?: string
) => {
    try {
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
            with: {
                contactInfo: true,
            },
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        
        if (requestingUserId && listing.sellerId === requestingUserId) {
            return { success: true, data: listing.contactInfo, isOwner: true };
        }

        
        if (requestingUserId) {
            const acceptedRequest = await db.query.bookPurchaseRequests.findFirst({
                where: and(
                    eq(bookPurchaseRequests.listingId, listingId),
                    eq(bookPurchaseRequests.buyerId, requestingUserId),
                    eq(bookPurchaseRequests.status, "accepted")
                ),
            });

            if (acceptedRequest) {
                return { success: true, data: listing.contactInfo, hasAccess: true };
            }
        }

        
        return {
            success: true,
            data: null,
            hasContactInfo: !!listing.contactInfo,
            message: "Request must be accepted to view contact info.",
        };
    } catch (error) {
        console.error("Error getting seller contact info:", error);
        return { success: false, message: "Failed to get contact info." };
    }
};

export const deleteSellerContactInfo = async (listingId: number, sellerId: string) => {
    try {
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        if (listing.sellerId !== sellerId) {
            return { success: false, message: "You are not authorized to delete this." };
        }

        await db.delete(sellerContactInfo).where(eq(sellerContactInfo.listingId, listingId));

        return { success: true, message: "Contact info deleted." };
    } catch (error) {
        console.error("Error deleting seller contact info:", error);
        return { success: false, message: "Failed to delete contact info." };
    }
};
