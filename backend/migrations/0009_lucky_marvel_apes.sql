CREATE TABLE "event_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"objectives" text,
	"target_audience" text,
	"prerequisites" text,
	"rules" text,
	"judging_criteria" text,
	"banner_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_categories_club_id_idx" ON "event_categories" USING btree ("club_id");