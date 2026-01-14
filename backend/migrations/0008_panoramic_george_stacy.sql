CREATE TABLE "event_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"full_description" text,
	"objectives" text,
	"target_audience" text,
	"prerequisites" text,
	"rules" text,
	"judging_criteria" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"about_club" text,
	"mission" text,
	"vision" text,
	"achievements" text,
	"benefits" text,
	"contact_phone" varchar(50),
	"website_url" varchar(500),
	"social_links" jsonb,
	"total_events_hosted" integer DEFAULT 0 NOT NULL,
	"established_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_profiles" ADD CONSTRAINT "club_profiles_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_details_event_id_idx" ON "event_details" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_profiles_club_id_idx" ON "club_profiles" USING btree ("club_id");