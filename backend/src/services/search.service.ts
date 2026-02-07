import { and, eq, ilike, notInArray, or } from "drizzle-orm";
import locationData from "../data/campus_data.json" with { type: "json" };
import { db } from "../lib/db.js";
import { bookListings } from "../models/book_buy_sell-schema.js";
import { clubs, events } from "../models/event-schema.js";
import { notice } from "../models/notice-schema.js";
import { getBlockedUserIds } from "./trust.service.js";

interface SearchInput {
  query: string;
  limit?: number;
  userId?: string;
}

type CampusService = { name?: string; purpose?: string; location?: string };
type CampusBuilding = {
  id: string;
  name: string;
  description: string;
  coordinates: { lat: number; lng: number };
  services?: CampusService[];
};

type SearchableBuilding = CampusBuilding & {
  searchableText: string;
  iconText: string;
};

function getLocationIcon(description: string) {
  const desc = (description ?? "").toLowerCase();

  if (desc.includes("bank") || desc.includes("atm")) return "bank-icon";
  if (desc.includes("mess") || desc.includes("canteen") || desc.includes("food")) return "food-icon";
  if (desc.includes("library")) return "library-icon";
  if (desc.includes("department")) return "dept-icon";
  if (desc.includes("mandir")) return "temple-icon";
  if (desc.includes("gym") || desc.includes("sport")) return "gym-icon";
  if (desc.includes("football")) return "football-icon";
  if (desc.includes("cricket")) return "cricket-icon";
  if (desc.includes("basketball") || desc.includes("volleyball")) return "volleyball-icon";
  if (desc.includes("hostel")) return "hostel-icon";
  if (desc.includes("lab")) return "lab-icon";
  if (desc.includes("helicopter")) return "helipad-icon";
  if (desc.includes("parking")) return "parking-icon";
  if (desc.includes("electrical club")) return "electrical-icon";
  if (desc.includes("music club")) return "music-icon";
  if (desc.includes("center for energy studies")) return "energy-icon";
  if (desc.includes("the helm of ioe pulchowk")) return "helm-icon";
  if (desc.includes("pi chautari") || desc.includes("park") || desc.includes("garden")) return "garden-icon";
  if (desc.includes("store") || desc.includes("bookshop")) return "store-icon";
  if (desc.includes("quarter")) return "quarter-icon";
  if (desc.includes("robotics club")) return "robotics-icon";
  if (desc.includes("clinic") || desc.includes("health")) return "clinic-icon";
  if (desc.includes("badminton")) return "badminton-icon";
  if (desc.includes("entrance")) return "entrance-icon";
  if (desc.includes("office") || desc.includes("ntbns") || desc.includes("seds") || desc.includes("cids")) return "office-icon";
  if (desc.includes("building")) return "building-icon";
  if (desc.includes("block") || desc.includes("embark")) return "block-icon";
  if (desc.includes("cave")) return "cave-icon";
  if (desc.includes("fountain")) return "fountain-icon";
  if (desc.includes("water vending machine") || desc.includes("water")) return "water-vending-machine-icon";
  if (desc.includes("workshop")) return "workshop-icon";
  if (desc.includes("toilet") || desc.includes("washroom")) return "toilet-icon";
  if (desc.includes("bridge")) return "bridge-icon";
  return "custom-marker";
}

const searchableBuildings: SearchableBuilding[] = ((locationData as any)?.buildings ?? []).map(
  (building: CampusBuilding) => {
    const allServices = building.services ?? [];
    const servicesText = allServices
      .flatMap((service) => [service?.name, service?.purpose, service?.location])
      .filter(Boolean)
      .join(" ");

    const searchableText = [building.name, building.description, servicesText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const iconText = [building.name, building.description, servicesText]
      .filter(Boolean)
      .join(" ");

    return {
      ...building,
      searchableText,
      iconText,
    };
  },
);

export async function globalSearch(input: SearchInput) {
  const query = input.query?.trim();
  const limit = Math.max(1, Math.min(25, input.limit ?? 6));

  if (!query || query.length < 2) {
    return {
      success: true,
      data: {
        query: query ?? "",
        clubs: [],
        events: [],
        books: [],
        notices: [],
        places: [],
        total: 0,
      },
    };
  }

  const term = `%${query}%`;
  const blockedUserIds = input.userId ? await getBlockedUserIds(input.userId) : [];

  const [clubResults, eventResults, noticeResults, bookResults] = await Promise.all([
    db.query.clubs.findMany({
      where: or(ilike(clubs.name, term), ilike(clubs.description, term)),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit,
      columns: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
      },
    }),

    db.query.events.findMany({
      where: or(
        ilike(events.title, term),
        ilike(events.description, term),
        ilike(events.eventType, term),
        ilike(events.venue, term),
      ),
      orderBy: (table, { desc }) => [desc(table.eventStartTime)],
      limit,
      columns: {
        id: true,
        title: true,
        description: true,
        eventStartTime: true,
        eventEndTime: true,
        venue: true,
        clubId: true,
        bannerUrl: true,
      },
      with: {
        club: {
          columns: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    }),

    db.query.notice.findMany({
      where: or(ilike(notice.title, term), ilike(notice.content, term)),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit,
      columns: {
        id: true,
        title: true,
        content: true,
        section: true,
        subsection: true,
        attachmentUrl: true,
        createdAt: true,
      },
    }),

    db.query.bookListings.findMany({
      where:
        blockedUserIds.length > 0
          ? and(
              eq(bookListings.status, "available"),
              notInArray(bookListings.sellerId, blockedUserIds),
              or(
                ilike(bookListings.title, term),
                ilike(bookListings.author, term),
                ilike(bookListings.isbn, term),
                ilike(bookListings.description, term),
              ),
            )
          : and(
              eq(bookListings.status, "available"),
              or(
                ilike(bookListings.title, term),
                ilike(bookListings.author, term),
                ilike(bookListings.isbn, term),
                ilike(bookListings.description, term),
              ),
            ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit,
      columns: {
        id: true,
        title: true,
        author: true,
        price: true,
        status: true,
        sellerId: true,
      },
      with: {
        images: {
          columns: {
            imageUrl: true,
          },
          limit: 1,
        },
        seller: {
          columns: {
            id: true,
            name: true,
            image: true,
            isVerifiedSeller: true,
          },
        },
      },
    }),
  ]);

  const normalizedTerm = query.toLowerCase();
  const places = searchableBuildings
    .filter((building) => building.searchableText.includes(normalizedTerm))
    .slice(0, limit)
    .map((building) => {
      const services = (building.services ?? []).slice(0, 3);
      return {
        id: building.id,
        name: building.name,
        description: building.description,
        coordinates: building.coordinates,
        icon: getLocationIcon(building.iconText),
        services,
      };
    });

  return {
    success: true,
    data: {
      query,
      clubs: clubResults,
      events: eventResults,
      books: bookResults,
      notices: noticeResults,
      places,
      total:
        clubResults.length +
        eventResults.length +
        bookResults.length +
        noticeResults.length +
        places.length,
    },
  };
}

