CREATE TABLE "book_purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"buyer_id" text NOT NULL,
	"status" "transaction_status" DEFAULT 'requested' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "seller_contact_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"primary_contact_method" "contact_method" NOT NULL,
	"whatsapp_number" varchar(20),
	"facebook_messenger" varchar(255),
	"telegram_username" varchar(255),
	"email" varchar(255),
	"phone_number" varchar(20),
	"other_contact_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_contact_info_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
DROP TABLE "buyer_contact_info" CASCADE;--> statement-breakpoint
ALTER TABLE "book_purchase_requests" ADD CONSTRAINT "book_purchase_requests_listing_id_book_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_purchase_requests" ADD CONSTRAINT "book_purchase_requests_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_contact_info" ADD CONSTRAINT "seller_contact_info_listing_id_book_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."book_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_request_unique_idx" ON "book_purchase_requests" USING btree ("listing_id","buyer_id");--> statement-breakpoint
CREATE INDEX "purchase_request_listing_idx" ON "book_purchase_requests" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "purchase_request_buyer_idx" ON "book_purchase_requests" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "seller_contact_listing_idx" ON "seller_contact_info" USING btree ("listing_id");