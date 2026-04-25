-- Add PhotoLicense enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhotoLicense') THEN
    CREATE TYPE "PhotoLicense" AS ENUM ('ALL_RIGHTS_RESERVED', 'CC_BY_NC_ND', 'CC_BY_NC', 'CC_BY_NC_SA', 'CC_BY', 'CC_BY_SA');
  END IF;
END $$;

-- Add license and watermarkEnabled columns to Photo table
ALTER TABLE "photos" ADD COLUMN "license" "PhotoLicense" DEFAULT 'ALL_RIGHTS_RESERVED' NOT NULL;
ALTER TABLE "photos" ADD COLUMN "watermark_enabled" BOOLEAN DEFAULT false NOT NULL;
