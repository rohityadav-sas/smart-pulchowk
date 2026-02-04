import { db } from "../lib/db.js";
import { conversations, messages } from "../models/chat-schema.js";
import { user } from "../models/auth-schema.js";
import { bookListings, bookPurchaseRequests } from "../models/book_buy_sell-schema.js";
import { eq, and, or, desc } from "drizzle-orm";
import { sendToUser } from "./notification.service.js";

export const sendMessage = async (senderId: string, listingId: number, content: string, buyerId?: string) => {
    try {
        // 1. Get the listing to find the seller
        const listing = await db.query.bookListings.findFirst({
            where: eq(bookListings.id, listingId),
        });

        if (!listing) {
            return { success: false, message: "Listing not found." };
        }

        const sellerId = listing.sellerId;
        const targetBuyerId = buyerId || (senderId === sellerId ? null : senderId);

        if (!targetBuyerId) {
            return {
                success: false,
                message: "Recipient (buyer) must be specified when the seller sends a message."
            };
        }

        if (senderId !== sellerId) {
            const acceptedRequest = await db.query.bookPurchaseRequests.findFirst({
                where: and(
                    eq(bookPurchaseRequests.listingId, listingId),
                    eq(bookPurchaseRequests.buyerId, targetBuyerId),
                    eq(bookPurchaseRequests.status, "accepted")
                ),
            });

            if (!acceptedRequest) {
                return {
                    success: false,
                    message: "Chat is only available after your purchase request has been accepted."
                };
            }
        }

        // 2. Find or create conversation
        let conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.listingId, listingId),
                eq(conversations.buyerId, targetBuyerId)
            ),
        });

        if (!conversation) {
            const [newConversation] = await db.insert(conversations).values({
                listingId,
                buyerId: targetBuyerId,
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

        // 4. Update conversation timestamp and reset deletion flags
        await db.update(conversations)
            .set({
                updatedAt: new Date(),
                buyerDeleted: false,
                sellerDeleted: false
            })
            .where(eq(conversations.id, conversation.id));

        // 5. Get sender info for notifications
        const recipientId = senderId === sellerId ? conversation.buyerId : sellerId;
        const sender = await db.query.user.findFirst({ where: eq(user.id, senderId) });

        // 6. Send FCM push notification (WebSocket events removed)
        sendToUser(recipientId, {
            title: sender?.name || "New Message",
            body: content,
            data: {
                type: 'chat_message',
                conversationId: conversation.id.toString(),
                senderId,
                senderName: sender?.name || "Someone",
                content: content,
            }
        });

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
                and(
                    eq(conversations.buyerId, userId),
                    eq(conversations.buyerDeleted, false)
                ),
                and(
                    eq(conversations.sellerId, userId),
                    eq(conversations.sellerDeleted, false)
                )
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


export const sendMessageToConversation = async (conversationId: number, senderId: string, content: string) => {
    try {

        const conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.id, conversationId),
                or(
                    eq(conversations.buyerId, senderId),
                    eq(conversations.sellerId, senderId)
                )
            ),
        });

        if (!conversation) {
            return { success: false, message: "Conversation not found or access denied." };
        }


        // If it's a seller, they can always reply.
        // If it's a buyer, we check if they still have access (any status is fine for now to allow history clearing/post-purchase chat)
        // unless the user specifically wants strict "accepted only" even for replies.
        // But usually once a chat starts, it stays open.
        // Let's at least allow sellers to reply.
        if (senderId !== conversation.sellerId) {
            const request = await db.query.bookPurchaseRequests.findFirst({
                where: and(
                    eq(bookPurchaseRequests.listingId, conversation.listingId),
                    eq(bookPurchaseRequests.buyerId, conversation.buyerId)
                ),
            });

            if (!request) {
                return {
                    success: false,
                    message: "Chat is no longer available."
                };
            }
        }


        const [newMessage] = await db.insert(messages).values({
            conversationId,
            senderId,
            content,
        }).returning();


        await db.update(conversations)
            .set({
                updatedAt: new Date(),
                buyerDeleted: false,
                sellerDeleted: false
            })
            .where(eq(conversations.id, conversationId));

        // 4. Send notification to recipient
        const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
        const sender = await db.query.user.findFirst({ where: eq(user.id, senderId) });

        sendToUser(recipientId, {
            title: sender?.name || "New Message",
            body: content,
            data: {
                type: 'chat_message',
                conversationId: conversationId.toString(),
                senderId,
                senderName: sender?.name || "Someone",
                content: content,
            }
        });

        return { success: true, data: newMessage };
    } catch (error) {
        console.error("Error in sendMessageToConversation service:", error);
        return { success: false, message: "Failed to send message." };
    }
};

export const deleteConversation = async (conversationId: number, userId: string) => {
    try {
        // 1. Verify user is part of conversation
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

        const isBuyer = conversation.buyerId === userId;

        // 2. Set the deleted flag for this user
        if (isBuyer) {
            await db.update(conversations)
                .set({ buyerDeleted: true })
                .where(eq(conversations.id, conversationId));
        } else {
            await db.update(conversations)
                .set({ sellerDeleted: true })
                .where(eq(conversations.id, conversationId));
        }

        // 3. Re-fetch to check if both are now deleted
        const updatedConversation = await db.query.conversations.findFirst({
            where: eq(conversations.id, conversationId),
        });

        if (updatedConversation && updatedConversation.buyerDeleted === true && updatedConversation.sellerDeleted === true) {
            // Permanently delete if both deleted
            await db.delete(conversations).where(eq(conversations.id, conversationId));
            return { success: true, message: "Conversation deleted permanently." };
        }

        return { success: true, message: "Conversation deleted for you." };
    } catch (error) {
        console.error("Error in deleteConversation service:", error);
        return { success: false, message: "Failed to delete conversation." };
    }
};
