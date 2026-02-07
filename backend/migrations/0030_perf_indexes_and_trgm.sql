CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_buyer_deleted_updated_idx" ON "conversations" USING btree ("buyer_id","buyer_deleted","updated_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_seller_deleted_updated_idx" ON "conversations" USING btree ("seller_id","seller_deleted","updated_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notice_section_subsection_created_idx" ON "notice" USING btree ("section","subsection","created_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "clubs_name_trgm_idx" ON "clubs" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clubs_description_trgm_idx" ON "clubs" USING gin ((coalesce("description", '')) gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "events_title_trgm_idx" ON "events" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_description_trgm_idx" ON "events" USING gin ((coalesce("description", '')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_type_trgm_idx" ON "events" USING gin ("event_type" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_venue_trgm_idx" ON "events" USING gin ((coalesce("venue", '')) gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "notice_title_trgm_idx" ON "notice" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notice_content_trgm_idx" ON "notice" USING gin ("content" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "book_listings_title_trgm_idx" ON "book_listings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_listings_author_trgm_idx" ON "book_listings" USING gin ("author" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_listings_isbn_trgm_idx" ON "book_listings" USING gin ((coalesce("isbn", '')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_listings_description_trgm_idx" ON "book_listings" USING gin ((coalesce("description", '')) gin_trgm_ops);
