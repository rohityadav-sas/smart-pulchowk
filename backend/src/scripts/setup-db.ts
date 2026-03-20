import { sql } from "drizzle-orm";
import { db } from "../lib/db.js";

async function setupDb() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "notice_external_ref_unique"
    ON "notice" ("external_ref")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "notice_category_created_id_idx"
    ON "notice" ("category", "created_at" DESC, "id" DESC)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "notice_category_level_created_id_idx"
    ON "notice" ("category", "level", "created_at" DESC, "id" DESC)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "notice_created_id_idx"
    ON "notice" ("created_at" DESC, "id" DESC)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "notice_title_trgm_idx"
    ON "notice" USING gin ("title" gin_trgm_ops)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "notification_reads_user_deleted_idx"
    ON "notification_reads" ("user_id", "deleted_at")
  `);

  console.log("Database setup SQL applied successfully.");
}

void setupDb().catch((error) => {
  console.error("Database setup failed:", error);
  process.exit(1);
});
