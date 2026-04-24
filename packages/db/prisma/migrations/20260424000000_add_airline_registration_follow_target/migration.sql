-- Add airline and registration to FollowTargetType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'FollowTargetType' AND e.enumlabel = 'airline') THEN
    ALTER TYPE "FollowTargetType" ADD VALUE 'airline';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'FollowTargetType' AND e.enumlabel = 'registration') THEN
    ALTER TYPE "FollowTargetType" ADD VALUE 'registration';
  END IF;
END $$;
