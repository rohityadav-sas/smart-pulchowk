import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import path from 'path'
import { createServer } from 'http'
import compression from 'compression'
import { sql } from 'drizzle-orm'
import { auth } from './lib/auth.js'
import ENV from './config/ENV.js'
import { db } from './lib/db.js'
import eventRoutes from './routes/events.route.js'
import clubProfileRoutes from './routes/clubProfile.route.js'
import chatBotRoutes from './routes/chatBot.route.js'
import userRoutes from './routes/user.route.js'
import bookRoutes from './routes/books.route.js'
import classroomRoutes from './routes/classroom.route.js'
import chatRoutes from './routes/chat.route.js'
import noticeRoutes from './routes/notice.route.js'
import adminRoutes from './routes/admin.route.js'
import searchRoutes from './routes/search.route.js'
import notificationsRoutes from './routes/notifications.route.js'
import lostFoundRoutes from './routes/lostFound.route.js'
import { startNotificationReminderJobs } from './services/notification-jobs.service.js'

const app = express()
const httpServer = createServer(app)

const __dirname = import.meta.dirname

app.all('/api/auth/*splat', toNodeHandler(auth))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use("/api/events", eventRoutes)
app.use("/api/clubs", clubProfileRoutes)
app.use("/api/chatbot", chatBotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/lost-found", lostFoundRoutes);

app.use(
  express.static(path.join(__dirname, '../../frontend/dist'), {
    etag: true,
    setHeaders: (res, filePath) => {
      const fileName = path.basename(filePath)

      if (fileName === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache')
        return
      }

      const isHashedAsset =
        /\.[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|png|jpe?g|svg)$/.test(fileName)

      if (isHashedAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
    },
  }),
)

app.get('/{*splat}', async (_, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

async function ensureRuntimeSchema() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notice' AND column_name = 'section'
      ) THEN
        ALTER TABLE "notice" RENAME COLUMN "section" TO "category";
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notice' AND column_name = 'subsection'
      ) THEN
        ALTER TABLE "notice" RENAME COLUMN "subsection" TO "level";
      END IF;
    END $$;
  `)
  await db.execute(sql`ALTER TABLE "notice" DROP COLUMN IF EXISTS "content"`)
  await db.execute(sql`ALTER TABLE "notice" ALTER COLUMN "level" DROP NOT NULL`)
  await db.execute(sql`ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "published_date" varchar(100)`)
  await db.execute(sql`ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "source_url" text`)
  await db.execute(sql`ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "external_ref" varchar(120)`)
  await db.execute(sql`ALTER TABLE "notice" DROP COLUMN IF EXISTS "author_id"`)
  await db.execute(sql`ALTER TABLE "notice" DROP COLUMN IF EXISTS "attachment_name"`)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "notice_external_ref_unique"
    ON "notice" ("external_ref")
  `)

  await db.execute(sql`
    ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb
    DEFAULT '{"eventReminders":true,"marketplaceAlerts":true,"noticeUpdates":true,"classroomAlerts":true,"chatAlerts":true,"adminAlerts":true}'::jsonb
    NOT NULL
  `)
  await db.execute(sql`
    ALTER TABLE "user"
    ALTER COLUMN "notification_preferences"
    SET DEFAULT '{"eventReminders":true,"marketplaceAlerts":true,"noticeUpdates":true,"classroomAlerts":true,"chatAlerts":true,"adminAlerts":true}'::jsonb
  `)
  await db.execute(sql`
    UPDATE "user"
    SET "notification_preferences" = coalesce("notification_preferences", '{}'::jsonb)
      - 'inApp'
      - 'emailDigest'
      - 'soundEffects'
      || '{"classroomAlerts":true,"chatAlerts":true,"adminAlerts":true}'::jsonb
    WHERE "notification_preferences" ? 'inApp'
       OR "notification_preferences" ? 'emailDigest'
       OR "notification_preferences" ? 'soundEffects'
       OR NOT ("notification_preferences" ? 'classroomAlerts')
       OR NOT ("notification_preferences" ? 'chatAlerts')
       OR NOT ("notification_preferences" ? 'adminAlerts')
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_found_item_type') THEN
        CREATE TYPE lost_found_item_type AS ENUM ('lost', 'found');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_found_category') THEN
        CREATE TYPE lost_found_category AS ENUM ('documents', 'electronics', 'accessories', 'ids_cards', 'keys', 'bags', 'other');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_found_status') THEN
        CREATE TYPE lost_found_status AS ENUM ('open', 'claimed', 'resolved', 'closed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_found_claim_status') THEN
        CREATE TYPE lost_found_claim_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "lost_found_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
      "item_type" lost_found_item_type NOT NULL,
      "title" varchar(180) NOT NULL,
      "description" text NOT NULL,
      "category" lost_found_category NOT NULL,
      "lost_found_date" timestamp NOT NULL,
      "location_text" varchar(220) NOT NULL,
      "contact_note" varchar(220),
      "status" lost_found_status DEFAULT 'open' NOT NULL,
      "reward_text" varchar(120),
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "lost_found_images" (
      "id" serial PRIMARY KEY NOT NULL,
      "item_id" integer NOT NULL REFERENCES "lost_found_items"("id") ON DELETE cascade,
      "image_url" text NOT NULL,
      "cloudinary_public_id" text,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "lost_found_claims" (
      "id" serial PRIMARY KEY NOT NULL,
      "item_id" integer NOT NULL REFERENCES "lost_found_items"("id") ON DELETE cascade,
      "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
      "message" text NOT NULL,
      "status" lost_found_claim_status DEFAULT 'pending' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "lost_found_claims_item_requester_unique_idx"
    ON "lost_found_claims" ("item_id", "requester_id")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_items_type_status_created_idx"
    ON "lost_found_items" ("item_type", "status", "created_at")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_items_category_created_idx"
    ON "lost_found_items" ("category", "created_at")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_items_owner_created_idx"
    ON "lost_found_items" ("owner_id", "created_at")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_images_item_sort_idx"
    ON "lost_found_images" ("item_id", "sort_order")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_claims_item_status_idx"
    ON "lost_found_claims" ("item_id", "status")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lost_found_claims_requester_created_idx"
    ON "lost_found_claims" ("requester_id", "created_at")
  `)
}

async function startServer() {
  const runRuntimeSchemaChecks = async () => {
    try {
      await ensureRuntimeSchema()
    } catch (error) {
      console.error('Failed to apply runtime schema checks:', error)
    }
  }

  if (ENV.MODE === "DEV") {
    httpServer.listen(3000, () =>
      console.log(`Server is running on port 3000 in ${ENV.MODE} mode`),
    )

    // Keep dev startup responsive; don't block listen on schema sync.
    void runRuntimeSchemaChecks()
  } else {
    await runRuntimeSchemaChecks()
  }

  startNotificationReminderJobs()
}

void startServer()

export default app
