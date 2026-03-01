import locationData from "../data/campus_data.json" with { type: "json" };
import studentSupportKbData from "../data/student_support_kb.json" with {
  type: "json",
};
import { GoogleGenerativeAI } from "@google/generative-ai";
import ENV from "../config/ENV.js";
import {
  buildAppContext,
  type AppContextTopic,
} from "./chatbot-context.service.js";

export type ConciergeAction =
  | "show_route"
  | "show_location"
  | "show_multiple_locations"
  | "text_answer";

export type ConciergeIntent =
  | "route_navigation"
  | "location_lookup"
  | "process_howto"
  | "policy_query"
  | "service_lookup"
  | "office_lookup"
  | "deadline_query"
  | "escalation"
  | "unknown"
  | "notice_query"
  | "event_query"
  | "club_query"
  | "lost_found_query"
  | "marketplace_query"
  | "app_help";

type SourceType = "official_page" | "office_confirmed" | "map_data";

type Role = "start" | "end" | "destination";

interface BuildingCoordinates {
  lat: number;
  lng: number;
}

interface Building {
  id: string;
  name: string;
  coordinates: BuildingCoordinates;
  description?: string;
  services?: Array<{
    name?: string;
    purpose?: string;
    location?: string;
  }>;
}

interface StudentSupportEntry {
  id: string;
  intent: ConciergeIntent;
  category: string;
  question_patterns: string[];
  keywords: string[];
  answer: string;
  location_ids?: string[];
  source_type: SourceType;
  last_verified_at: string;
  follow_up?: string[];
}

interface FallbackEntry {
  message: string;
  location_ids?: string[];
  follow_up?: string[];
}

interface StudentSupportKb {
  entries: StudentSupportEntry[];
  fallbacks: Record<string, FallbackEntry>;
}

interface LlmLocation {
  building_id?: string;
  building_name?: string;
  role?: Role;
}

interface LlmResult {
  message?: string;
  action?: ConciergeAction;
  locations?: LlmLocation[];
}

export interface ConciergeLocationPayload {
  building_id: string;
  building_name: string;
  coordinates: BuildingCoordinates;
  service_name: string | null;
  service_location: string | null;
  role: Role;
}

export interface ConciergeResponsePayload {
  message: string;
  locations: ConciergeLocationPayload[];
  action: ConciergeAction;
  intent: ConciergeIntent;
  verified: boolean;
  sources: string[];
  follow_up: string[];
}

interface ResolveOptions {
  allowLlm?: boolean;
}

const SOURCE_PRIORITY: Record<SourceType, number> = {
  official_page: 3,
  office_confirmed: 2,
  map_data: 1,
};

const ROUTE_HINTS = [
  "route",
  "directions",
  "navigate",
  "how to get",
  "take me from",
  "from",
  "to",
  "between",
];

const LOCATION_HINTS = [
  "where is",
  "locate",
  "show me",
  "find",
  "nearest",
  "location",
  "which block",
];

const SUPPORT_HINTS = [
  "admission",
  "document",
  "registration",
  "exam",
  "transcript",
  "certificate",
  "hostel",
  "fee",
  "payment",
  "deadline",
  "complaint",
  "health",
  "clinic",
  "library",
  "borrow",
  "id card",
];

const NOTICE_HINTS = [
  "notice",
  "notices",
  "result",
  "results",
  "exam routine",
  "exam center",
  "application form",
  "summarize notice",
  "latest notice",
  "recent notice",
];

const EVENT_HINTS = [
  "event",
  "events",
  "upcoming event",
  "workshop",
  "hackathon",
  "seminar",
  "competition",
  "register for",
  "what events",
];

const CLUB_HINTS = [
  "club",
  "clubs",
  "society",
  "organization",
  "student club",
  "active club",
  "list club",
];

const LOST_FOUND_HINTS = [
  "lost and found",
  "lost item",
  "found item",
  "missing item",
  "anyone found",
  "lost something",
];

const MARKETPLACE_HINTS = [
  "book marketplace",
  "sell book",
  "buy book",
  "marketplace",
  "textbook",
  "second hand book",
  "available book",
];

const APP_HELP_HINTS = [
  "how to use",
  "app help",
  "what can you do",
  "help me",
  "what features",
  "how does this app",
];

const LOCATION_ALIAS_MAP: Record<string, string> = {
  dean: "dean-office",
  "dean office": "dean-office",
  "exam office": "exam-control-office",
  "exam control": "exam-control-office",
  library: "pulchowk-library",
  fsu: "fsu-office",
  clinic: "fsu-clinic",
  canteen: "campus-canteen",
  mess: "campus-mess",
  stationery: "om-stationery",
  "print shop": "om-stationery",
  niraula: "niraula-stores",
  robotics: "robotics-club",
  "electrical club": "electrical-club",
  "music club": "music-club",
  seds: "seds-pulchowk",
  locus: "locus-office",
  atm: "nabil-bank-atm",
  "nabil atm": "nabil-bank-atm",
  "siddhartha atm": "siddhartha-bank-atm",
  "boys hostel": "block-a-hostel",
  "girls hostel": "girls-hostel",
  "msc hostel": "msc-hostel",
  "civil department": "dept-civil",
  "architecture department": "dept-architecture",
  "electrical department": "dept-electrical-electronics-computer",
  "mechanical department": "dept-mechanical-aerospace",
  "applied sciences": "dept-applied-sciences",
  humanities: "dept-science-humanities",
};

const KB = studentSupportKbData as StudentSupportKb;
const BUILDINGS = ((locationData as any)?.buildings ?? []) as Building[];
const BUILDING_BY_ID = new Map(BUILDINGS.map((item) => [item.id, item]));
const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function toLocationPayload(
  building: Building,
  role: Role = "destination",
): ConciergeLocationPayload {
  return {
    building_id: building.id,
    building_name: building.name,
    coordinates: building.coordinates,
    service_name: null,
    service_location: null,
    role,
  };
}

function getBuildingSearchText(building: Building): string {
  const serviceText = (building.services ?? [])
    .flatMap((service) => [service.name, service.purpose, service.location])
    .filter(Boolean)
    .join(" ");
  return normalize(
    [building.id, building.name, building.description ?? "", serviceText].join(
      " ",
    ),
  );
}

function scoreBuildingQuery(building: Building, query: string): number {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);
  const name = normalize(building.name);
  const id = normalize(building.id);
  const searchBlob = getBuildingSearchText(building);

  let score = 0;
  if (!normalizedQuery) return score;
  if (name === normalizedQuery || id === normalizedQuery) score += 100;
  if (name.includes(normalizedQuery) || normalizedQuery.includes(name))
    score += 40;

  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    else if (id.includes(token)) score += 5;
    else if (searchBlob.includes(token)) score += 2;
  }

  return score;
}

function findAliasBuildingIds(query: string): string[] {
  const normalized = normalize(query);
  const matches = new Set<string>();
  for (const [alias, buildingId] of Object.entries(LOCATION_ALIAS_MAP)) {
    if (normalized.includes(alias)) matches.add(buildingId);
  }
  return [...matches].filter((id) => BUILDING_BY_ID.has(id));
}

function findBuildings(query: string, limit = 3): Array<{
  building: Building;
  score: number;
}> {
  const aliasIds = findAliasBuildingIds(query);
  const aliasResults = aliasIds
    .map((id) => BUILDING_BY_ID.get(id))
    .filter((value): value is Building => !!value)
    .map((building) => ({ building, score: 120 }));

  const scored = BUILDINGS.map((building) => ({
    building,
    score: scoreBuildingQuery(building, query),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const merged = [...aliasResults];
  for (const item of scored) {
    if (merged.some((existing) => existing.building.id === item.building.id)) {
      continue;
    }
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged.slice(0, limit);
}

function inferActionByLocationCount(count: number): ConciergeAction {
  if (count <= 1) return "show_location";
  return "show_multiple_locations";
}

function inferIntentFromQuery(query: string): ConciergeIntent {
  const normalized = normalize(query);

  if (
    normalized.includes("from ") &&
    normalized.includes(" to ") &&
    includesAny(normalized, ROUTE_HINTS)
  ) {
    return "route_navigation";
  }

  if (includesAny(normalized, ["deadline", "last date", "closing date"])) {
    return "deadline_query";
  }

  if (
    includesAny(normalized, [
      "emergency",
      "urgent",
      "complaint",
      "report",
      "harassment",
      "lost",
    ])
  ) {
    return "escalation";
  }

  if (
    includesAny(normalized, [
      "policy",
      "rules",
      "hours",
      "timing",
      "fee",
      "payment",
      "receipt",
    ])
  ) {
    return "policy_query";
  }

  if (
    includesAny(normalized, [
      "where",
      "office",
      "whom to contact",
      "who handles",
      "which office",
    ])
  ) {
    return "office_lookup";
  }

  if (includesAny(normalized, ["how", "process", "apply", "register"])) {
    return "process_howto";
  }

  if (
    includesAny(normalized, [
      "service",
      "canteen",
      "atm",
      "water",
      "toilet",
      "hostel",
      "library",
      "clinic",
      "print",
      "stationery",
    ])
  ) {
    return "service_lookup";
  }

  if (includesAny(normalized, LOCATION_HINTS)) {
    return "location_lookup";
  }

  // ── App-wide intents ────────────────────────────────────────────────────
  if (includesAny(normalized, NOTICE_HINTS)) return "notice_query";
  if (includesAny(normalized, EVENT_HINTS)) return "event_query";
  if (includesAny(normalized, CLUB_HINTS)) return "club_query";
  if (includesAny(normalized, LOST_FOUND_HINTS)) return "lost_found_query";
  if (includesAny(normalized, MARKETPLACE_HINTS)) return "marketplace_query";
  if (includesAny(normalized, APP_HELP_HINTS)) return "app_help";

  return "unknown";
}

function matchSupportEntry(query: string): StudentSupportEntry | null {
  const normalized = normalize(query);
  const candidates = KB.entries
    .map((entry) => {
      let score = 0;
      for (const pattern of entry.question_patterns ?? []) {
        const normalizedPattern = normalize(pattern);
        if (normalizedPattern && normalized.includes(normalizedPattern)) {
          score += 8;
        }
      }
      for (const keyword of entry.keywords ?? []) {
        const normalizedKeyword = normalize(keyword);
        if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
          score += 2;
        }
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const priorityA = SOURCE_PRIORITY[a.entry.source_type] ?? 0;
      const priorityB = SOURCE_PRIORITY[b.entry.source_type] ?? 0;
      if (priorityB !== priorityA) return priorityB - priorityA;
      return (
        new Date(b.entry.last_verified_at).getTime() -
        new Date(a.entry.last_verified_at).getTime()
      );
    });

  if (candidates.length === 0) return null;
  if (candidates[0].score < 4) return null;
  return candidates[0].entry;
}

function makeSupportResponse(entry: StudentSupportEntry): ConciergeResponsePayload {
  const locations = (entry.location_ids ?? [])
    .map((id) => BUILDING_BY_ID.get(id))
    .filter((building): building is Building => !!building)
    .map((building) => toLocationPayload(building));

  return {
    message: entry.answer,
    locations,
    action: inferActionByLocationCount(locations.length),
    intent: entry.intent,
    verified: true,
    sources: [
      `student_support_kb:${entry.id}`,
      `source_type:${entry.source_type}`,
      `last_verified:${entry.last_verified_at}`,
    ],
    follow_up: entry.follow_up ?? [],
  };
}

function isRouteQuery(query: string): boolean {
  const normalized = normalize(query);
  if (extractRouteEndpoints(query)) return true;

  return (
    includesAny(normalized, [
      "show route",
      "directions",
      "navigate",
      "how to get from",
    ])
  );
}

function extractRouteEndpoints(query: string): { start: string; end: string } | null {
  const raw = normalize(query);
  const fromTo = raw.match(/\bfrom\s+(.+?)\s+\bto\s+(.+)$/i);
  if (fromTo) {
    return {
      start: fromTo[1].trim(),
      end: fromTo[2].trim(),
    };
  }

  const betweenAnd = raw.match(/\bbetween\s+(.+?)\s+\band\s+(.+)$/i);
  if (betweenAnd) {
    return {
      start: betweenAnd[1].trim(),
      end: betweenAnd[2].trim(),
    };
  }

  // Support terse route queries such as: "dean office to om stationery store"
  const plainTo = raw.match(/^(.+?)\s+\bto\s+(.+)$/i);
  if (plainTo) {
    const start = plainTo[1].trim();
    const end = plainTo[2].trim();
    const invalidPlainStart = new Set([
      "how",
      "what",
      "where",
      "when",
      "why",
      "who",
      "go",
      "walk",
      "move",
      "head",
      "get",
      "take",
      "need",
      "want",
      "trying",
    ]);

    if (!invalidPlainStart.has(start) && start.length > 2 && end.length > 2) {
      return { start, end };
    }
  }

  return null;
}

function resolveDeterministicRoute(query: string): ConciergeResponsePayload | null {
  const endpoints = extractRouteEndpoints(query);
  if (!endpoints) return null;

  const startMatch = findBuildings(endpoints.start, 1)[0];
  const endMatch = findBuildings(endpoints.end, 1)[0];
  if (!startMatch || !endMatch) return null;
  if (startMatch.score < 10 || endMatch.score < 10) return null;
  if (startMatch.building.id === endMatch.building.id) return null;

  const locations: ConciergeLocationPayload[] = [
    toLocationPayload(startMatch.building, "start"),
    toLocationPayload(endMatch.building, "end"),
  ];

  return {
    message: `From ${startMatch.building.name}, walk toward ${endMatch.building.name}. I have pinned both points so you can follow the map route clearly.`,
    locations,
    action: "show_route",
    intent: "route_navigation",
    verified: true,
    sources: ["campus_data:buildings", "source_type:map_data"],
    follow_up: [
      "If you want, ask for landmarks near the destination before you start.",
    ],
  };
}

function isLocationLookupQuery(query: string): boolean {
  const normalized = normalize(query);
  return (
    includesAny(normalized, LOCATION_HINTS) ||
    normalized.startsWith("where ") ||
    normalized.startsWith("show ")
  );
}

function resolveLocationLookup(query: string): ConciergeResponsePayload | null {
  const matches = findBuildings(query, 3).filter((item) => item.score >= 10);
  if (matches.length === 0) return null;

  const locations = matches.map((match) => toLocationPayload(match.building));
  if (locations.length === 1) {
    const building = matches[0].building;
    return {
      message: `${building.name} is mapped on campus. ${building.description ?? "I have highlighted the location for you."}`,
      locations,
      action: "show_location",
      intent: "location_lookup",
      verified: true,
      sources: ["campus_data:buildings", "source_type:map_data"],
      follow_up: ["Ask for directions from your current point if needed."],
    };
  }

  return {
    message: `I found multiple relevant locations: ${matches.map((item) => item.building.name).join(", ")}.`,
    locations,
    action: "show_multiple_locations",
    intent: "location_lookup",
    verified: true,
    sources: ["campus_data:buildings", "source_type:map_data"],
    follow_up: ["Tell me your start and destination if you want route guidance."],
  };
}

function getFallbackLocationIdsByIntent(
  intent: ConciergeIntent,
  query: string,
): string[] {
  const normalized = normalize(query);
  if (
    includesAny(normalized, ["exam", "admit", "result", "transcript", "roll"])
  ) {
    return ["exam-control-office"];
  }
  if (includesAny(normalized, ["health", "medical", "sick", "injury"])) {
    return ["fsu-clinic"];
  }
  if (includesAny(normalized, ["complaint", "harassment", "union"])) {
    return ["fsu-office"];
  }
  if (includesAny(normalized, ["hostel", "mess", "canteen"])) {
    return ["campus-mess", "girls-hostel"];
  }
  if (includesAny(normalized, ["library", "book issue", "reading"])) {
    return ["pulchowk-library"];
  }
  if (includesAny(normalized, ["print", "stationery", "photocopy"])) {
    return ["om-stationery"];
  }
  if (intent === "deadline_query") {
    return ["exam-control-office", "dean-office"];
  }
  if (intent === "escalation") {
    return ["dean-office"];
  }
  return ["dean-office"];
}

function buildFallbackResponse(
  intent: ConciergeIntent,
  query: string,
): ConciergeResponsePayload {
  const fallbackKey =
    intent === "deadline_query" ||
    intent === "escalation" ||
    intent === "policy_query"
      ? intent
      : "general";
  const fallback = KB.fallbacks[fallbackKey] ?? KB.fallbacks.general;
  const locationIds = fallback.location_ids?.length
    ? fallback.location_ids
    : getFallbackLocationIdsByIntent(intent, query);

  const locations = locationIds
    .map((id) => BUILDING_BY_ID.get(id))
    .filter((building): building is Building => !!building)
    .map((building) => toLocationPayload(building));

  return {
    message: fallback.message,
    locations,
    action: inferActionByLocationCount(locations.length),
    intent: intent === "unknown" ? "office_lookup" : intent,
    verified: false,
    sources: [],
    follow_up:
      fallback.follow_up ?? [
        "Ask a specific office-focused question and I will guide you there.",
      ],
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeAction(action: unknown): ConciergeAction {
  if (action === "show_route") return action;
  if (action === "show_multiple_locations") return action;
  return "show_location";
}

function mapLlmLocation(raw: LlmLocation, role: Role): ConciergeLocationPayload | null {
  const byId =
    typeof raw.building_id === "string" ? BUILDING_BY_ID.get(raw.building_id) : null;
  const byName =
    !byId && typeof raw.building_name === "string"
      ? findBuildings(raw.building_name, 1)[0]?.building
      : null;
  const resolved = byId ?? byName;
  if (!resolved) return null;
  const locationRole: Role = raw.role === "start" || raw.role === "end" ? raw.role : role;
  return toLocationPayload(resolved, locationRole);
}

async function resolveWithLlmNavigation(
  query: string,
): Promise<ConciergeResponsePayload | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const compactBuildings = BUILDINGS.map((building) => ({
      id: building.id,
      name: building.name,
      coordinates: building.coordinates,
      description: building.description ?? "",
    }));

    const prompt = `You are a campus navigation assistant for Pulchowk Campus.
Use only the provided verified building list.
Do not invent buildings.

Buildings:
${JSON.stringify(compactBuildings)}

User query: ${query}

Return only JSON:
{
  "message": "short helpful text without coordinates",
  "action": "show_route" | "show_location" | "show_multiple_locations",
  "locations": [
    {
      "building_id": "verified id",
      "building_name": "verified name",
      "role": "start" | "end" | "destination"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const parsed = safeJsonParse(result.response.text()) as LlmResult | null;
    if (!parsed || !Array.isArray(parsed.locations)) return null;

    const action = sanitizeAction(parsed.action);
    const mappedLocations = parsed.locations
      .map((item, index) =>
        mapLlmLocation(item, action === "show_route" && index === 0 ? "start" : action === "show_route" ? "end" : "destination"),
      )
      .filter((item): item is ConciergeLocationPayload => !!item);

    if (action === "show_route" && mappedLocations.length < 2) return null;
    if (action !== "show_route" && mappedLocations.length < 1) return null;

    return {
      message:
        typeof parsed.message === "string" && parsed.message.trim().length > 0
          ? parsed.message.trim()
          : "I found relevant campus locations and highlighted them on the map.",
      action,
      locations: mappedLocations,
      intent: action === "show_route" ? "route_navigation" : "location_lookup",
      verified: true,
      sources: ["campus_data:buildings", "source_type:map_data", "llm:gemini-2.5-flash"],
      follow_up: ["Ask for landmark-based directions if you need simpler wayfinding."],
    };
  } catch (error) {
    console.error("LLM navigation fallback failed:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App-wide context resolution (hybrid: live DB data + LLM)
// ─────────────────────────────────────────────────────────────────────────────

const APP_INTENT_TOPICS: Partial<Record<ConciergeIntent, AppContextTopic>> = {
  notice_query: "notices",
  event_query: "events",
  club_query: "clubs",
  lost_found_query: "lost_found",
  marketplace_query: "marketplace",
  app_help: "all",
};

const APP_KNOWLEDGE = `
Smart Pulchowk is a campus companion app for Pulchowk Campus (IOE, Tribhuvan University) students.
Key features:
- Notices: IOE exam results, routines, application forms, and general campus notices (auto-synced from exam.ioe.tu.edu.np).
- Events: Browse and register for campus events organized by student clubs.
- Clubs: View active student clubs, their profiles, missions, and social links.
- Map & Navigation: Interactive campus map with building locations and route guidance.
- Book Marketplace: Buy and sell second-hand textbooks with other students.
- Lost & Found: Report or search for lost/found items on campus.
- Chat: Direct messaging between students for book deals.
- Notifications: Push notifications for new notices, events, and chat messages.
- Calendar: Academic calendar view.
- Classroom: Classroom and course information.
`.trim();

async function resolveWithAppContext(
  query: string,
  intent: ConciergeIntent,
): Promise<ConciergeResponsePayload | null> {
  const topic = APP_INTENT_TOPICS[intent];
  if (!topic) return null;

  try {
    const contextData = await buildAppContext(topic);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `You are Smart Pulchowk Assistant — a smart, friendly campus companion for Pulchowk Campus students.

About the app:
${APP_KNOWLEDGE}

Live data from the app:
${contextData}

User query: ${query}

Instructions:
- Answer the user's question using the live data above.
- Be concise, helpful, and student-friendly.
- If the user asks to summarize notices, provide a clear summary grouped by category.
- If the user asks about events, list them with dates and organizers.
- If no relevant data is available, say so politely and suggest alternatives.
- Do NOT make up data that is not in the context above.

Return only JSON:
{
  "message": "your helpful response"
}`;

    const result = await model.generateContent(prompt);
    const parsed = safeJsonParse(result.response.text()) as {
      message?: string;
    } | null;

    if (
      !parsed ||
      typeof parsed.message !== "string" ||
      !parsed.message.trim()
    ) {
      return null;
    }

    return {
      message: parsed.message.trim(),
      locations: [],
      action: "text_answer",
      intent,
      verified: true,
      sources: [`app_context:${topic}`, "llm:gemini-2.5-flash"],
      follow_up: [],
    };
  } catch (error) {
    console.error("App context resolution failed:", error);
    return null;
  }
}

export async function resolveStudentConciergeQuery(
  query: string,
  options: ResolveOptions = {},
): Promise<ConciergeResponsePayload> {
  const rawQuery = query.trim();
  const normalizedQuery = normalize(rawQuery);
  const allowLlm = options.allowLlm ?? true;

  if (!rawQuery) {
    return buildFallbackResponse("unknown", rawQuery);
  }

  if (isRouteQuery(normalizedQuery)) {
    const deterministic = resolveDeterministicRoute(rawQuery);
    if (deterministic) return deterministic;

    if (allowLlm) {
      const llm = await resolveWithLlmNavigation(rawQuery);
      if (llm) return llm;
    }

    return buildFallbackResponse("route_navigation", rawQuery);
  }

  const matchedEntry = matchSupportEntry(rawQuery);
  if (matchedEntry) {
    return makeSupportResponse(matchedEntry);
  }

  if (isLocationLookupQuery(rawQuery)) {
    const locationLookup = resolveLocationLookup(rawQuery);
    if (locationLookup) return locationLookup;
  }

  const inferredIntent = inferIntentFromQuery(rawQuery);

  // ── App-wide intent resolution (hybrid: live DB + LLM) ──────────────────
  const isAppIntent = inferredIntent in APP_INTENT_TOPICS;
  if (isAppIntent && allowLlm) {
    const appResult = await resolveWithAppContext(rawQuery, inferredIntent);
    if (appResult) return appResult;
  }

  const supportHeavy =
    inferredIntent === "process_howto" ||
    inferredIntent === "policy_query" ||
    inferredIntent === "office_lookup" ||
    inferredIntent === "deadline_query" ||
    inferredIntent === "escalation" ||
    includesAny(normalizedQuery, SUPPORT_HINTS);

  if (supportHeavy) {
    return buildFallbackResponse(inferredIntent, rawQuery);
  }

  const locationLookup = resolveLocationLookup(rawQuery);
  if (locationLookup) return locationLookup;

  if (isLocationLookupQuery(rawQuery) && allowLlm) {
    const llm = await resolveWithLlmNavigation(rawQuery);
    if (llm) return llm;
  }

  // ── Final fallback: try app context for ambiguous queries ────────────────
  if (allowLlm) {
    const appFallback = await resolveWithAppContext(rawQuery, "app_help");
    if (appFallback) return appFallback;
  }

  return buildFallbackResponse(inferIntentFromQuery(rawQuery), rawQuery);
}
