import {
    pgTable,
    serial,
    text,
    timestamp,
    integer,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema.js";
import { bookListings } from "./book_buy_sell-schema.js";

export const conversations = pgTable(
    "conversations",
    {
        id: serial("id").primaryKey(),
        listingId: integer("listing_id").notNull().references(() => bookListings.id, { onDelete: "cascade" }),
        buyerId: text("buyer_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        sellerId: text("seller_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("conversations_listing_idx").on(table.listingId),
        index("conversations_buyer_idx").on(table.buyerId),
        index("conversations_seller_idx").on(table.sellerId),
    ]
);

export const messages = pgTable(
    "messages",
    {
        id: serial("id").primaryKey(),
        conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
        senderId: text("sender_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        content: text("content").notNull(),
        isRead: text("is_read").default("false").notNull(), // Using text because of bool issues in some pg versions/drizzle configs if any, but boolean is better. Let's use boolean if available.
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("messages_conversation_idx").on(table.conversationId),
        index("messages_sender_idx").on(table.senderId),
    ]
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    listing: one(bookListings, {
        fields: [conversations.listingId],
        references: [bookListings.id],
    }),
    buyer: one(user, {
        fields: [conversations.buyerId],
        references: [user.id],
        relationName: "buyer_conversations",
    }),
    seller: one(user, {
        fields: [conversations.sellerId],
        references: [user.id],
        relationName: "seller_conversations",
    }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    sender: one(user, {
        fields: [messages.senderId],
        references: [user.id],
    }),
}));
