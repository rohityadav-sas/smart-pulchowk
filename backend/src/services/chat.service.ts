import { db } from "../lib/db.js";
import { conversations, messages } from "../models/chat-schema.js";
import { user } from "../models/auth-schema.js";
import {
  bookListings,
  bookPurchaseRequests,
} from "../models/book_buy_sell-schema.js";
import { eq, and, or, desc, lt, count, inArray, not } from "drizzle-orm";
import { sendToUser } from "./notification.service.js";
import { isUserBlockedBetween } from "./trust.service.js";

function hasMention(content: string) {
  return /(^|\s)@\w+/i.test(content);
}

export const sendMessage = async (
  senderId: string,
  listingId: number,
  content: string,
  buyerId?: string,
) => {
  try {
    // 1. Get the listing to find the seller
    const listing = await db.query.bookListings.findFirst({
      where: eq(bookListings.id, listingId),
      with: {
        images: {
          limit: 1,
        },
      },
    });

    if (!listing) {
      return { success: false, message: "Listing not found." };
    }

    const sellerId = listing.sellerId;
    const targetBuyerId = buyerId || (senderId === sellerId ? null : senderId);

    if (!targetBuyerId) {
      return {
        success: false,
        message:
          "Recipient (buyer) must be specified when the seller sends a message.",
      };
    }

    const prospectiveRecipientId =
      senderId === sellerId ? targetBuyerId : sellerId;
    const blocked = await isUserBlockedBetween(
      senderId,
      prospectiveRecipientId,
    );
    if (blocked) {
      return {
        success: false,
        message: "Messaging is blocked due to trust settings between users.",
      };
    }

    if (senderId !== sellerId) {
      const acceptedRequest = await db.query.bookPurchaseRequests.findFirst({
        where: and(
          eq(bookPurchaseRequests.listingId, listingId),
          eq(bookPurchaseRequests.buyerId, targetBuyerId),
          eq(bookPurchaseRequests.status, "accepted"),
        ),
      });

      if (!acceptedRequest) {
        return {
          success: false,
          message:
            "Chat is only available after your purchase request has been accepted.",
        };
      }
    }

    // 2. Find or create conversation
    let conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.listingId, listingId),
        eq(conversations.buyerId, targetBuyerId),
      ),
    });

    if (!conversation) {
      const [newConversation] = await db
        .insert(conversations)
        .values({
          listingId,
          buyerId: targetBuyerId,
          sellerId: sellerId,
        })
        .returning();
      conversation = newConversation;
    }

    // 3. Create message
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId,
        content,
      })
      .returning();

    // 4. Update conversation timestamp and reset deletion flags
    await db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        buyerDeleted: false,
        sellerDeleted: false,
      })
      .where(eq(conversations.id, conversation.id));

    // 5. Get sender info for notifications
    const recipientId = senderId === sellerId ? conversation.buyerId : sellerId;
    const sender = await db.query.user.findFirst({
      where: eq(user.id, senderId),
    });

    const messageType = hasMention(content) ? "chat_mention" : "chat_message";

    // 6. Send FCM push notification for every message
    await sendToUser(recipientId, {
      title: sender?.name || "New Message",
      body: content,
      data: {
        type: messageType,
        conversationId: conversation.id.toString(),
        listingId: listing.id.toString(),
        senderId,
        senderName: sender?.name || "Someone",
        content: content,
        iconKey: "chat",
        ...(listing.images?.[0]?.imageUrl
          ? { thumbnailUrl: listing.images[0].imageUrl }
          : {}),
      },
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
          eq(conversations.buyerDeleted, false),
        ),
        and(
          eq(conversations.sellerId, userId),
          eq(conversations.sellerDeleted, false),
        ),
      ),
      with: {
        listing: {
          with: {
            images: true,
          },
        },
        buyer: true,
        seller: true,
        messages: {
          limit: 1,
          orderBy: [desc(messages.createdAt)],
        },
      },
      orderBy: [desc(conversations.updatedAt)],
    });

    const data = userConversations.map((conv) => {
      // Calculate unread count (messages NOT sent by current user where is_read is false)
      // Note: With current 'with' relation, messages only returns the last one.
      // We might need a separate query or adjust the relation if we want full count efficiently.
      // For now, let's just count them properly.
      return {
        ...conv,
        unreadCount: 0, // Placeholder, will populate below
      }
    })

    // Fetch unread counts for all these conversations
    const conversationIds = userConversations.map(c => c.id);
    if (conversationIds.length > 0) {
      const unreadCounts = await db
        .select({
          conversationId: messages.conversationId,
          count: count(),
        })
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, conversationIds),
            eq(messages.isRead, false),
            not(eq(messages.senderId, userId))
          )
        )
        .groupBy(messages.conversationId);

      data.forEach(conv => {
        const found = unreadCounts.find(u => u.conversationId === conv.id);
        (conv as any).unreadCount = found ? Number(found.count) : 0;
      });
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getConversations service:", error);
    return { success: false, message: "Failed to fetch conversations." };
  }
};

export const getMessages = async (
  conversationId: number,
  userId: string,
  options?: { limit?: number; before?: Date },
) => {
  try {
    // Verify user is part of conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.buyerId, userId),
          eq(conversations.sellerId, userId),
        ),
      ),
    });

    if (!conversation) {
      return {
        success: false,
        message: "Conversation not found or access denied.",
      };
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 30, 100));
    const whereClause = options?.before
      ? and(
          eq(messages.conversationId, conversationId),
          lt(messages.createdAt, options.before),
        )
      : eq(messages.conversationId, conversationId);

    const convoMessages = await db.query.messages.findMany({
      where: whereClause,
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1,
      with: {
        sender: true,
      },
    });

    const data = convoMessages.slice(0, limit);
    const hasMore = convoMessages.length > limit;
    const nextBefore =
      hasMore && data.length > 0
        ? data[data.length - 1].createdAt.toISOString()
        : null;

    return {
      success: true,
      data,
      meta: {
        limit,
        hasMore,
        nextBefore,
      },
    };
  } catch (error) {
    console.error("Error in getMessages service:", error);
    return { success: false, message: "Failed to fetch messages." };
  }
};

export const sendMessageToConversation = async (
  conversationId: number,
  senderId: string,
  content: string,
) => {
  try {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.buyerId, senderId),
          eq(conversations.sellerId, senderId),
        ),
      ),
    });

    if (!conversation) {
      return {
        success: false,
        message: "Conversation not found or access denied.",
      };
    }

    const listing = await db.query.bookListings.findFirst({
      where: eq(bookListings.id, conversation.listingId),
      with: {
        images: {
          limit: 1,
        },
      },
    });

    const participantRecipientId =
      senderId === conversation.buyerId
        ? conversation.sellerId
        : conversation.buyerId;
    const blocked = await isUserBlockedBetween(
      senderId,
      participantRecipientId,
    );
    if (blocked) {
      return {
        success: false,
        message: "Messaging is blocked due to trust settings between users.",
      };
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
          eq(bookPurchaseRequests.buyerId, conversation.buyerId),
        ),
      });

      if (!request) {
        return {
          success: false,
          message: "Chat is no longer available.",
        };
      }
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId,
        content,
      })
      .returning();

    await db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        buyerDeleted: false,
        sellerDeleted: false,
      })
      .where(eq(conversations.id, conversationId));

    // 4. Send notification to recipient
    const recipientId =
      senderId === conversation.buyerId
        ? conversation.sellerId
        : conversation.buyerId;
    const sender = await db.query.user.findFirst({
      where: eq(user.id, senderId),
    });

    const messageType = hasMention(content) ? "chat_mention" : "chat_message";

    // 4. Send notification for every message
    await sendToUser(recipientId, {
      title: sender?.name || "New Message",
      body: content,
      data: {
        type: messageType,
        conversationId: conversationId.toString(),
        listingId: conversation.listingId.toString(),
        senderId,
        senderName: sender?.name || "Someone",
        content: content,
        iconKey: "chat",
        ...(listing?.images?.[0]?.imageUrl
          ? { thumbnailUrl: listing.images[0].imageUrl }
          : {}),
      },
    });

    return { success: true, data: newMessage };
  } catch (error) {
    console.error("Error in sendMessageToConversation service:", error);
    return { success: false, message: "Failed to send message." };
  }
};

export const deleteConversation = async (
  conversationId: number,
  userId: string,
) => {
  try {
    // 1. Verify user is part of conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.buyerId, userId),
          eq(conversations.sellerId, userId),
        ),
      ),
    });

    if (!conversation) {
      return {
        success: false,
        message: "Conversation not found or access denied.",
      };
    }

    const isBuyer = conversation.buyerId === userId;

    // 2. Set the deleted flag for this user
    if (isBuyer) {
      await db
        .update(conversations)
        .set({ buyerDeleted: true })
        .where(eq(conversations.id, conversationId));
    } else {
      await db
        .update(conversations)
        .set({ sellerDeleted: true })
        .where(eq(conversations.id, conversationId));
    }

    // 3. Re-fetch to check if both are now deleted
    const updatedConversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (
      updatedConversation &&
      updatedConversation.buyerDeleted === true &&
      updatedConversation.sellerDeleted === true
    ) {
      // Permanently delete if both deleted
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
      return { success: true, message: "Conversation deleted permanently." };
    }

    return { success: true, message: "Conversation deleted for you." };
  } catch (error) {
    console.error("Error in deleteConversation service:", error);
    return { success: false, message: "Failed to delete conversation." };
  }
};
export const markMessagesAsRead = async (
  conversationId: number,
  userId: string,
) => {
  try {
    // Verify user is part of conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.buyerId, userId),
          eq(conversations.sellerId, userId),
        ),
      ),
    });

    if (!conversation) {
      return {
        success: false,
        message: "Conversation not found or access denied.",
      };
    }

    // Mark all messages as read where sender is NOT the current user
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isRead, false),
          not(eq(messages.senderId, userId)),
        ),
      );

    return { success: true, message: "Messages marked as read." };
  } catch (error) {
    console.error("Error in markMessagesAsRead service:", error);
    return { success: false, message: "Failed to mark messages as read." };
  }
};
