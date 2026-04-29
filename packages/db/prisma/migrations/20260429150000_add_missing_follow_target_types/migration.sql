-- Add missing FollowTargetType enum values that may not exist in production.
-- The init migration used CREATE TYPE which includes them, but production may
-- have had the enum created earlier with only 'user' and 'airport'.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'FollowTargetType' AND e.enumlabel = 'manufacturer') THEN
    ALTER TYPE "FollowTargetType" ADD VALUE 'manufacturer';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'FollowTargetType' AND e.enumlabel = 'family') THEN
    ALTER TYPE "FollowTargetType" ADD VALUE 'family';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'FollowTargetType' AND e.enumlabel = 'variant') THEN
    ALTER TYPE "FollowTargetType" ADD VALUE 'variant';
  END IF;
END $$;
