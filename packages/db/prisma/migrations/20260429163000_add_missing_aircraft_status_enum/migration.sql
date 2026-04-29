-- Add missing 'pending_approval' value to AircraftStatus enum if it doesn't exist.
-- Production may have the enum with only 'active' from a prior manual setup.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'AircraftStatus' AND e.enumlabel = 'pending_approval') THEN
    ALTER TYPE "AircraftStatus" ADD VALUE 'pending_approval';
  END IF;
END $$;
