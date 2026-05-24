-- CreateTable
CREATE TABLE "user_tiers" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "uploads_per_day" INTEGER,
    "uploads_per_week" INTEGER,
    "can_create_community" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_tiers_slug_key" ON "user_tiers"("slug");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tier_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "user_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default tiers. Limits mirror the previously hard-coded
-- USER_TIER_LIMITS constants in @spotterspace/shared (50/month free,
-- 200/month premium) re-expressed as daily/weekly caps. The free tier
-- cannot create communities by default; premium can.
INSERT INTO "user_tiers" ("id", "slug", "name", "price_cents", "currency", "uploads_per_day", "uploads_per_week", "can_create_community", "display_order", "is_active", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'free',    'Free',    0,    'USD', 5,  20, false, 0, true, now(), now()),
    (gen_random_uuid(), 'premium', 'Premium', 999,  'USD', 25, 150, true,  1, true, now(), now());

-- Backfill: assign every existing user to the free tier so resolvers can
-- rely on a non-null tier without having to special-case legacy rows.
UPDATE "users"
   SET "tier_id" = (SELECT "id" FROM "user_tiers" WHERE "slug" = 'free')
 WHERE "tier_id" IS NULL;
