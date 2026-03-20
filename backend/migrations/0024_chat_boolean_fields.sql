-- Convert text fields to boolean in conversations table
ALTER TABLE "conversations" ALTER COLUMN "buyer_deleted" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "buyer_deleted" TYPE boolean USING CASE WHEN "buyer_deleted" = 'true' THEN true ELSE false END;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "buyer_deleted" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "seller_deleted" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "seller_deleted" TYPE boolean USING CASE WHEN "seller_deleted" = 'true' THEN true ELSE false END;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "seller_deleted" SET DEFAULT false;--> statement-breakpoint

-- Convert text field to boolean in messages table
ALTER TABLE "messages" ALTER COLUMN "is_read" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "is_read" TYPE boolean USING CASE WHEN "is_read" = 'true' THEN true ELSE false END;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "is_read" SET DEFAULT false;
