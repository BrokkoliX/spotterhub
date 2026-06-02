-- Add WatermarkPosition enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WatermarkPosition') THEN
    CREATE TYPE "WatermarkPosition" AS ENUM (
      'TOP_LEFT',
      'TOP_CENTER',
      'TOP_RIGHT',
      'MIDDLE_LEFT',
      'CENTER',
      'MIDDLE_RIGHT',
      'BOTTOM_LEFT',
      'BOTTOM_CENTER',
      'BOTTOM_RIGHT'
    );
  END IF;
END $$;

-- Add user-configurable watermark columns to the photos table.
-- All three are nullable; null means "no per-photo override" and the
-- image processor falls back to the WATERMARK_DEFAULTS in
-- @spotterspace/shared. The legacy watermark_enabled flag remains
-- the source of truth for whether a watermarked variant is generated.
ALTER TABLE "photos" ADD COLUMN "watermark_position" "WatermarkPosition";
ALTER TABLE "photos" ADD COLUMN "watermark_size" INTEGER;
ALTER TABLE "photos" ADD COLUMN "watermark_opacity" INTEGER;
