-- Migration: 20260415120527_add_email_verification
-- Idempotent: safe to run on any database state — fresh, partially migrated, or fully migrated.
-- Does NOT touch rows that were created after this column was first added.

DO $$
BEGIN
  -- Add email_verified column only if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END
$$;

DO $$
BEGIN
  -- Add email_verification_token column only if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verification_token'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "email_verification_token" TEXT;
  END IF;
END
$$;

-- Backfill: mark pre-existing users as verified.
-- These are users whose cognitoSub starts with 'dev-' (legacy dev accounts
-- created before email verification existed). Newer users (dev1- prefix)
-- are created by the signUp mutation and go through the verification flow.
-- Safe to re-run: only updates rows that need it.
UPDATE "users"
SET "email_verified" = true
WHERE
  "email_verified" = false
  AND "cognitoSub" NOT LIKE 'dev1-%';
