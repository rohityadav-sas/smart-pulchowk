CREATE TYPE "public"."book_conditions" AS ENUM('new', 'like_new', 'good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('whatsapp', 'facebook_messenger', 'telegram', 'email', 'phone', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('available', 'pending', 'sold', 'removed');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('requested', 'accepted', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "book_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"parent_category_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"image_public_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"author" varchar(255) NOT NULL,
	"isbn" varchar(20),
	"edition" varchar(100),
	"publisher" varchar(255),
	"publication_year" integer,
	"condition" "book_conditions" NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"status" "listing_status" DEFAULT 'available' NOT NULL,
	"course_code" varchar(50),
	"view_count" integer DEFAULT 0 NOT NULL,
	"category_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sold_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "buyer_contact_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"primary_contact_method" "contact_method" NOT NULL,
	"whatsapp_number" varchar(20),
	"facebook_messenger" varchar(255),
	"telegram_username" varchar(255),
	"email" varchar(255),
	"phone_number" varchar(20),
	"other_contact_method" varchar(255),
	"other_contact_details" varchar(500),
	"preferred_contact_time" varchar(100),
	"additional_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'clubs' AND column_name = 'logo_public_Id'
    ) THEN
        ALTER TABLE "clubs" RENAME COLUMN "logo_public_Id" TO "logo_public_id";
    END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_parent_category_id_book_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."book_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_images" ADD CONSTRAINT "book_images_listing_id_book_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_listings" ADD CONSTRAINT "book_listings_category_id_book_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."book_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_books" ADD CONSTRAINT "saved_books_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_books" ADD CONSTRAINT "saved_books_listing_id_book_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_categories_parent_idx" ON "book_categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "book_categories_name_idx" ON "book_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "book_images_listing_idx" ON "book_images" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "book_listings_seller_idx" ON "book_listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "book_listings_category_idx" ON "book_listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "book_listings_course_idx" ON "book_listings" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "book_listings_department_idx" ON "book_listings" USING btree ("title");--> statement-breakpoint
CREATE INDEX "book_listings_price_idx" ON "book_listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "book_listings_createdAt_idx" ON "book_listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "book_listings_created_idx" ON "book_listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "book_listings_status_created_idx" ON "book_listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "book_listings_status_idx" ON "book_listings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_books_unique_idx" ON "saved_books" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "saved_books_user_idx" ON "saved_books" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_books_listing_idx" ON "saved_books" USING btree ("listing_id");
