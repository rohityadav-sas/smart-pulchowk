CREATE TABLE "listing_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_views" ADD CONSTRAINT "listing_views_listing_id_book_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_views" ADD CONSTRAINT "listing_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_views_listing_idx" ON "listing_views" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_views_user_unique_idx" ON "listing_views" USING btree ("listing_id","user_id");