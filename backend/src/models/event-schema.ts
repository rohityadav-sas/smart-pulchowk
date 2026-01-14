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
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema.ts";

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "ongoing",
  "completed",
  "cancelled",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "registered",
  "attended",
  "cancelled",
  "waitlisted",
]);

export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    authClubId: varchar("auth_club_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    email: varchar("email", { length: 255 }).notNull(),
    logoUrl: varchar("logo_url", { length: 500 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("clubs_email_idx").on(table.email),
    index("clubs_name_idx").on(table.name),
    index("clubs_auth_club_id_idx").on(table.authClubId),
  ]
);

export const clubAdmins = pgTable(
  "club_admins",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 })
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).default("admin").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("club_admins_unique_idx").on(table.clubId, table.userId),
  ]
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  status: eventStatusEnum("status").default("draft").notNull(),
  venue: varchar("venue", { length: 255 }),
  maxParticipants: integer("max_participants"),
  registrationDeadline: timestamp("registration_deadline", {
    mode: "date",
  }).notNull(),
  eventStartTime: timestamp("event_start_time", { mode: "date" }).notNull(),
  eventEndTime: timestamp("event_end_time", { mode: "date" }).notNull(),

  bannerUrl: varchar("banner_url", { length: 500 }),
  currentParticipants: integer("current_participants").default(0).notNull(),
  isRegistrationOpen: boolean("is_registration_open").default(true).notNull(),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("events_club_id_idx").on(table.clubId),
  index("events_status_idx").on(table.status),
  index("events_start_time_idx").on(table.eventStartTime),
]);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: registrationStatusEnum("status").default("registered").notNull(),
    registeredAt: timestamp("registered_at", { mode: "date" }).defaultNow().notNull(),
    attendedAt: timestamp("attended_at", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_user_event_idx").on(
      table.userId,
      table.eventId
    ),
    index("event_registrations_user_id_idx").on(
      table.userId
    ),
    index("event_registrations_event_id_idx").on(table.eventId),
    index("event_registrations_status_idx").on(table.status),
    index("event_registrations_registered_at_idx").on(
      table.registeredAt
    ),
  ]
);

export const clubProfiles = pgTable('club_profiles',
  {
    id: serial('id').primaryKey(),
    clubId: integer('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),

    aboutClub: text('about_club'),
    mission: text('mission'),
    vision: text('vision'),
    achievements: text('achievements'),

    benefits: text('benefits'),

    contactPhone: varchar('contact_phone', { length: 50 }),
    websiteUrl: varchar('website_url', { length: 500 }),

    socialLinks: jsonb('social_links').$type<{
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
      youtube?: string;
      discord?: string;
      github?: string;
      tiktok?: string;
    }>(),

    totalEventHosted: integer('total_events_hosted').default(0).notNull(),
    establishedYear: integer('established_year'),

    createdAt: timestamp('created_at', { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: "date" }).defaultNow().notNull(),
  }, (table) => [
    uniqueIndex('club_profiles_club_id_idx').on(table.clubId),
  ]);


export const aboutEvents = pgTable('event_details',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),

    fullDescription: text('full_description'),
    objectives: text('objectives'),
    targetAudience: text('target_audience'),
    prerequisites: text('prerequisites'),

    rules: text('rules'),
    judgingCriteria: text('judging_criteria'),


    createdAt: timestamp('created_at', { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: "date" }).defaultNow().notNull(),
  }, (table) => [
    uniqueIndex('event_details_event_id_idx').on(table.eventId),
  ]);

export const eventCategories = pgTable('event_categories',
  {
    id: serial('id').primaryKey(),
    clubId: integer('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    objectives: text('objectives'),
    targetAudience: text('target_audience'),
    prerequisites: text('prerequisites'),
    rules: text('rules'),
    judgingCriteria: text('judging_criteria'),
    bannerUrl: varchar('banner_url', { length: 500 }),

    createdAt: timestamp('created_at', { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: "date" }).defaultNow().notNull(),
  }, (table) => [
    index('event_categories_club_id_idx').on(table.clubId),
  ]);



export const clubsRelations = relations(clubs, ({ one, many }) => ({
  events: many(events),
  profiles: one(clubProfiles, {
    fields: [clubs.id],
    references: [clubProfiles.clubId],
  }),
  admins: many(clubAdmins),
  eventCategories: many(eventCategories),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  club: one(clubs, {
    fields: [events.clubId],
    references: [clubs.id],
  }),
  details: one(aboutEvents, {
    fields: [events.id],
    references: [aboutEvents.eventId],
  }),

  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(
  eventRegistrations,
  ({ one }) => ({
    user: one(user, {
      fields: [eventRegistrations.userId],
      references: [user.id],
    }),
    event: one(events, {
      fields: [eventRegistrations.eventId],
      references: [events.id],
    }),
  })
);

export const clubProfilesRelations = relations(clubProfiles, ({ one }) => ({
  club: one(clubs, {
    fields: [clubProfiles.clubId],
    references: [clubs.id],
  }),
}));

export const aboutEventsRelations = relations(aboutEvents, ({ one }) => ({
  event: one(events, {
    fields: [aboutEvents.eventId],
    references: [events.id],
  }),
}));

export const eventCategoriesRelations = relations(eventCategories, ({ one }) => ({
  club: one(clubs, {
    fields: [eventCategories.clubId],
    references: [clubs.id],
  }),
}));