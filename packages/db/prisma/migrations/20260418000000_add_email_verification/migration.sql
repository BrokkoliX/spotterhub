-- Add email verification columns if they don't exist (were in squashed init
-- but the init was marked as applied without running against the existing DB).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT;
