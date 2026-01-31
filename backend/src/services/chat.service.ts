import { db } from "../lib/db.js";
import { conversations, messages } from "../models/chat-schema.js";
import { bookListings } from "../models/book_buy_sell-schema.js";
import { eq, and, or, desc, sql } from "drizzle-orm";

export const sendMessage = async (senderId: string, listingId: number, content: string) => {
    try {
        // 1. Get the listing to find the seller
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        const sellerId = listing.sellerId;
        const buyerId = senderId === sellerId ? null : senderId; // If seller sends first (unlikely but possible), who is the buyer? 
        // Actually, normally a buyer starts a chat.

        if (senderId === sellerId) {
            return { success: false, message: "Sellers cannot start a chat with themselves." };
        }

        // 2. Find or create conversation
        let conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.listingId, listingId),
                eq(conversations.buyerId, senderId)
            ),
        });

        if (!conversation) {
            const [newConversation] = await db.insert(conversations).values({
                listingId,
                buyerId: senderId,
                sellerId: sellerId,
            }).returning();
            conversation = newConversation;
        }

        // 3. Create message
        const [newMessage] = await db.insert(messages).values({
            conversationId: conversation.id,
            senderId,
            content,
        }).returning();

        // 4. Update conversation timestamp
        await db.update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversation.id));

        return { success: true, data: newMessage };
    } catch (error) {
        console.error("Error in sendMessage service:", error);
        return { success: false, message: "Failed to send message." };
    }
};

export const getConversations = async (userId: string) => {
    try {
        const userConversations = await db.query.conversations.findMany({
            where: or(
                eq(conversations.buyerId, userId),
                eq(conversations.sellerId, userId)
            ),
            with: {
                listing: {
                    with: {
                        images: true,
                    }
                },
                buyer: true,
                seller: true,
                messages: {
                    limit: 1,
                    orderBy: [desc(messages.createdAt)],
                }
            },
            orderBy: [desc(conversations.updatedAt)],
        });

        return { success: true, data: userConversations };
    } catch (error) {
        console.error("Error in getConversations service:", error);
        return { success: false, message: "Failed to fetch conversations." };
    }
};

export const getMessages = async (conversationId: number, userId: string) => {
    try {
        // Verify user is part of conversation
        const conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.id, conversationId),
                or(
                    eq(conversations.buyerId, userId),
                    eq(conversations.sellerId, userId)
                )
            ),
        });

        if (!conversation) {
            return { success: false, message: "Conversation not found or access denied." };
        }

        const convoMessages = await db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            orderBy: [desc(messages.createdAt)],
            with: {
                sender: true,
            }
        });

        return { success: true, data: convoMessages };
    } catch (error) {
        console.error("Error in getMessages service:", error);
        return { success: false, message: "Failed to fetch messages." };
    }
};
