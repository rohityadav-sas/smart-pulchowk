import { desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { notice } from "../models/notice-schema.js";
import { events, clubs, clubProfiles } from "../models/event-schema.js";
import { lostFoundItems } from "../models/lost-found-schema.js";
import { bookListings } from "../models/book_buy_sell-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Notices
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecentNoticesSummary(limit = 10): Promise<string> {
  const rows = await db
    .select({
      title: notice.title,
      category: notice.category,
      publishedDate: notice.publishedDate,
    })
    .from(notice)
    .orderBy(desc(notice.createdAt))
    .limit(limit);

  if (rows.length === 0) return "No notices available at the moment.";

  const lines = rows.map((r, i) => {
    const date = r.publishedDate ?? "unknown date";
    return `${i + 1}. [${r.category}] ${r.title} (${date})`;
  });
  return `Recent Notices (${rows.length}):\n${lines.join("\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export async function getUpcomingEventsSummary(limit = 8): Promise<string> {
  const now = new Date();
  const rows = await db
    .select({
      title: events.title,
      description: events.description,
      venue: events.venue,
      eventStartTime: events.eventStartTime,
      eventEndTime: events.eventEndTime,
      clubName: clubs.name,
    })
    .from(events)
    .innerJoin(clubs, eq(events.clubId, clubs.id))
    .where(gt(events.eventStartTime, now))
    .orderBy(events.eventStartTime)
    .limit(limit);

  if (rows.length === 0) return "No upcoming events at the moment.";

  const lines = rows.map((r, i) => {
    const start = r.eventStartTime.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const venue = r.venue ? ` at ${r.venue}` : "";
    return `${i + 1}. "${r.title}" by ${r.clubName} — ${start}${venue}`;
  });
  return `Upcoming Events (${rows.length}):\n${lines.join("\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clubs
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveClubsSummary(): Promise<string> {
  const rows = await db
    .select({
      name: clubs.name,
      description: clubs.description,
      aboutClub: clubProfiles.aboutClub,
      mission: clubProfiles.mission,
    })
    .from(clubs)
    .leftJoin(clubProfiles, eq(clubs.id, clubProfiles.clubId))
    .where(eq(clubs.isActive, true))
    .orderBy(clubs.name);

  if (rows.length === 0) return "No active clubs found.";

  const lines = rows.map((r, i) => {
    const desc = r.aboutClub || r.description || "No description";
    // Truncate long descriptions
    const short = desc.length > 120 ? desc.slice(0, 120) + "…" : desc;
    return `${i + 1}. ${r.name} — ${short}`;
  });
  return `Active Clubs (${rows.length}):\n${lines.join("\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lost & Found
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecentLostFoundSummary(limit = 8): Promise<string> {
  const rows = await db
    .select({
      title: lostFoundItems.title,
      description: lostFoundItems.description,
      category: lostFoundItems.category,
      itemType: lostFoundItems.itemType,
      locationText: lostFoundItems.locationText,
      lostFoundDate: lostFoundItems.lostFoundDate,
    })
    .from(lostFoundItems)
    .where(eq(lostFoundItems.status, "open"))
    .orderBy(desc(lostFoundItems.createdAt))
    .limit(limit);

  if (rows.length === 0) return "No open lost & found items at the moment.";

  const lines = rows.map((r, i) => {
    const date = r.lostFoundDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${i + 1}. [${r.itemType.toUpperCase()}] ${r.title} — ${r.category}, near ${r.locationText} (${date})`;
  });
  return `Open Lost & Found Items (${rows.length}):\n${lines.join("\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Book Marketplace
// ─────────────────────────────────────────────────────────────────────────────

export async function getAvailableBooksSummary(limit = 8): Promise<string> {
  const rows = await db
    .select({
      title: bookListings.title,
      author: bookListings.author,
      price: bookListings.price,
      condition: bookListings.condition,
      courseCode: bookListings.courseCode,
    })
    .from(bookListings)
    .where(eq(bookListings.status, "available"))
    .orderBy(desc(bookListings.createdAt))
    .limit(limit);

  if (rows.length === 0)
    return "No books available in the marketplace at the moment.";

  const lines = rows.map((r, i) => {
    const course = r.courseCode ? ` (${r.courseCode})` : "";
    return `${i + 1}. "${r.title}" by ${r.author} — Rs. ${r.price}, ${r.condition}${course}`;
  });
  return `Available Books (${rows.length}):\n${lines.join("\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Context Builder
// ─────────────────────────────────────────────────────────────────────────────

export type AppContextTopic =
  | "notices"
  | "events"
  | "clubs"
  | "lost_found"
  | "marketplace"
  | "all";

const TOPIC_FETCHERS: Record<
  Exclude<AppContextTopic, "all">,
  () => Promise<string>
> = {
  notices: getRecentNoticesSummary,
  events: getUpcomingEventsSummary,
  clubs: getActiveClubsSummary,
  lost_found: getRecentLostFoundSummary,
  marketplace: getAvailableBooksSummary,
};

/**
 * Build a context string with live data for one or more topics.
 * Pass `"all"` to include every topic (useful for general queries).
 */
export async function buildAppContext(
  topics: AppContextTopic | AppContextTopic[],
): Promise<string> {
  const list = Array.isArray(topics) ? topics : [topics];

  const keysToFetch: Exclude<AppContextTopic, "all">[] = list.includes("all")
    ? (Object.keys(TOPIC_FETCHERS) as Exclude<AppContextTopic, "all">[])
    : (list.filter((t) => t !== "all") as Exclude<AppContextTopic, "all">[]);

  const results = await Promise.all(
    keysToFetch.map(async (key) => {
      try {
        return await TOPIC_FETCHERS[key]();
      } catch (error) {
        console.error(`chatbot-context: failed to fetch ${key}:`, error);
        return `${key}: data temporarily unavailable`;
      }
    }),
  );

  return results.join("\n\n");
}
