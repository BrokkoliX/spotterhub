-- Add approved column back to seller_profiles (for backward compat with photo marketplace)
ALTER TABLE "seller_profiles" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

-- Add active column to marketplace_items
ALTER TABLE "marketplace_items" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT false;
