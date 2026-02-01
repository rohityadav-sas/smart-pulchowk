import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    integer,
    boolean,
    pgEnum,
    uniqueIndex,
    index,
    decimal,
    interval,
    jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema.js";

export const bookConditions = pgEnum("book_conditions", [
    "new",
    "like_new",
    "good",
    "fair",
    "poor",
]);

export const listingStatusEnum = pgEnum("listing_status", [
    "available",
    "pending",
    "sold",
    "removed",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
    "requested",
    "accepted",
    "rejected",
    "completed",
    "cancelled",
]);

export const contactMethodEnum = pgEnum("contact_method", [
    "whatsapp",
    "facebook_messenger",
    "telegram",
    "email",
    "phone",
    "other",
]);

export const bookCategories = pgTable(
    "book_categories",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 100 }).notNull(),
        description: text("description"),
        parentCategoryId: integer("parent_category_id").references(
            () => bookCategories.id,
            { onDelete: "set null" }
        ),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("book_categories_parent_idx").on(table.parentCategoryId),
        index("book_categories_name_idx").on(table.name),
    ]
);

export const bookListings = pgTable(
    "book_listings",
    {
        id: serial("id").primaryKey(),
        sellerId: text("seller_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        title: varchar("title", { length: 255 }).notNull(),
        author: varchar("author", { length: 255 }).notNull(),
        isbn: varchar("isbn", { length: 20 }),
        edition: varchar("edition", { length: 100 }),
        publisher: varchar("publisher", { length: 255 }),
        publicationYear: integer("publication_year"),
        condition: bookConditions("condition").notNull(),
        description: text("description"),
        price: decimal("price", { precision: 10, scale: 2 }).notNull(),
        status: listingStatusEnum("status").default("available").notNull(),
        courseCode: varchar("course_code", { length: 50 }),
        viewCount: integer("view_count").default(0).notNull(),
        categoryId: integer("category_id").references(() => bookCategories.id, { onDelete: "set null" }),

        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
        soldAt: timestamp("sold_at", { mode: "date" })
    },
    (table) => [
        index("book_listings_seller_idx").on(table.sellerId),
        index("book_listings_category_idx").on(table.categoryId),
        index("book_listings_course_idx").on(table.courseCode),
        index("book_listings_department_idx").on(table.title),
        index("book_listings_price_idx").on(table.price),
        index("book_listings_createdAt_idx").on(table.createdAt),
        index("book_listings_created_idx").on(table.createdAt),
        index("book_listings_status_created_idx").on(table.status, table.createdAt),
        index("book_listings_status_idx").on(table.status),
    ]
);

export const bookImages = pgTable(
    "book_images",
    {
        id: serial("id").primaryKey(),
        listingId: integer("listing_id").notNull().references(() => bookListings.id, { onDelete: "cascade" }),
        imageUrl: varchar("image_url", { length: 500 }).notNull(),
        imagePublicId: varchar("image_public_id", { length: 255 }),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("book_images_listing_idx").on(table.listingId)
    ]
);

export const sellerContactInfo = pgTable(
    "seller_contact_info",
    {
        id: serial("id").primaryKey(),
        listingId: integer("listing_id").notNull().unique()
            .references(() => bookListings.id, { onDelete: "cascade" }),
        primaryContactMethod: contactMethodEnum("primary_contact_method").notNull(),
        whatsapp: varchar("whatsapp_number", { length: 20 }),
        facebookMessenger: varchar("facebook_messenger", { length: 255 }),
        telegramUsername: varchar("telegram_username", { length: 255 }),
        email: varchar("email", { length: 255 }),
        phoneNumber: varchar("phone_number", { length: 20 }),
        otherContactDetails: text("other_contact_details"),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("seller_contact_listing_idx").on(table.listingId),
    ]
);

export const bookPurchaseRequests = pgTable(
    "book_purchase_requests",
    {
        id: serial("id").primaryKey(),
        listingId: integer("listing_id").notNull()
            .references(() => bookListings.id, { onDelete: "cascade" }),
        buyerId: text("buyer_id").notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        status: transactionStatusEnum("status").default("requested").notNull(),
        message: text("message"),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
        respondedAt: timestamp("responded_at", { mode: "date" }),
    },
    (table) => [
        uniqueIndex("purchase_request_unique_idx").on(table.listingId, table.buyerId),
        index("purchase_request_listing_idx").on(table.listingId),
        index("purchase_request_buyer_idx").on(table.buyerId),
    ]
);

export const savedBooks = pgTable(
    "saved_books",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        listingId: integer("listing_id").notNull().references(() => bookListings.id, { onDelete: "cascade" }),

        notes: text("notes"),

        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("saved_books_unique_idx").on(table.userId, table.listingId),
        index("saved_books_user_idx").on(table.userId),
        index("saved_books_listing_idx").on(table.listingId),
    ]
);

export const listingViews = pgTable(
    "listing_views",
    {
        id: serial("id").primaryKey(),
        listingId: integer("listing_id").notNull().references(() => bookListings.id, { onDelete: "cascade" }),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    },
    (table) => [
        index("listing_views_listing_idx").on(table.listingId),
        uniqueIndex("listing_views_user_unique_idx").on(table.listingId, table.userId),
    ]
);


export const bookListingsRelations = relations(bookListings, ({ one, many }) => ({
    seller: one(user, {
        fields: [bookListings.sellerId],
        references: [user.id],
    }),
    category: one(bookCategories, {
        fields: [bookListings.categoryId],
        references: [bookCategories.id],
    }),
    images: many(bookImages),
    savedByUsers: many(savedBooks),
    contactInfo: one(sellerContactInfo),
    purchaseRequests: many(bookPurchaseRequests),
    views: many(listingViews),
}));

export const listingViewsRelations = relations(listingViews, ({ one }) => ({
    listing: one(bookListings, {
        fields: [listingViews.listingId],
        references: [bookListings.id],
    }),
    visitor: one(user, {
        fields: [listingViews.userId],
        references: [user.id],
    }),
}));

export const sellerContactInfoRelations = relations(sellerContactInfo, ({ one }) => ({
    listing: one(bookListings, {
        fields: [sellerContactInfo.listingId],
        references: [bookListings.id],
    }),
}));

export const bookPurchaseRequestsRelations = relations(bookPurchaseRequests, ({ one }) => ({
    listing: one(bookListings, {
        fields: [bookPurchaseRequests.listingId],
        references: [bookListings.id],
    }),
    buyer: one(user, {
        fields: [bookPurchaseRequests.buyerId],
        references: [user.id],
    }),
}));

export const bookImagesRelations = relations(bookImages, ({ one }) => ({
    listing: one(bookListings, {
        fields: [bookImages.listingId],
        references: [bookListings.id],
    }),
}));

export const savedBooksRelations = relations(savedBooks, ({ one }) => ({
    user: one(user, {
        fields: [savedBooks.userId],
        references: [user.id],
    }),
    listing: one(bookListings, {
        fields: [savedBooks.listingId],
        references: [bookListings.id],
    }),
}));

export const bookCategoriesRelations = relations(bookCategories, ({ one, many }) => ({
    parentCategory: one(bookCategories, {
        fields: [bookCategories.parentCategoryId],
        references: [bookCategories.id],
        relationName: "Subcategories",
    }),
    subcategories: many(bookCategories, {
        relationName: "Subcategories",
    }),
    bookListings: many(bookListings),
}));

