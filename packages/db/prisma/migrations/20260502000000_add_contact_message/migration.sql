-- Create contact_message table for user-to-admin contact form

CREATE TABLE "contact_message" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "email" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for user (nullable - anonymous users can also send messages)
ALTER TABLE "contact_message" ADD CONSTRAINT "contact_message_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key for reviewer
ALTER TABLE "contact_message" ADD CONSTRAINT "contact_message_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for querying by status (admin listing)
CREATE INDEX "contact_message_status_idx" ON "contact_message"("status");

-- Index for querying by user_id
CREATE INDEX "contact_message_user_id_idx" ON "contact_message"("user_id");

-- Index for ordering by created_at
CREATE INDEX "contact_message_created_at_idx" ON "contact_message"("created_at" DESC);
