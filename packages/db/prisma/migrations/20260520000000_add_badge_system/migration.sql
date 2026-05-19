-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('UPLOAD', 'ENGAGEMENT', 'COMMUNITY', 'STREAK', 'DIVERSITY', 'AWARD');

-- CreateEnum
CREATE TYPE "BadgeTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "BadgeTriggerType" AS ENUM ('AUTOMATIC', 'AWARDED');

-- CreateEnum
CREATE TYPE "PhotoAwardPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'badge_earned';

-- CreateTable
CREATE TABLE "badge_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_url" TEXT,
    "category" "BadgeCategory" NOT NULL,
    "tier" "BadgeTier" NOT NULL,
    "trigger_type" "BadgeTriggerType" NOT NULL,
    "trigger_metric" TEXT,
    "trigger_threshold" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "badge_definition_id" UUID NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_photo_id" UUID,
    "awarded_by" UUID,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_awards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "photo_id" UUID NOT NULL,
    "period" "PhotoAwardPeriod" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "like_count" INTEGER NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_slug_key" ON "badge_definitions"("slug");
CREATE INDEX "badge_definitions_category_idx" ON "badge_definitions"("category");
CREATE INDEX "badge_definitions_is_active_idx" ON "badge_definitions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_definition_id_key" ON "user_badges"("user_id", "badge_definition_id");
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");
CREATE INDEX "user_badges_badge_definition_id_idx" ON "user_badges"("badge_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "photo_awards_period_period_start_key" ON "photo_awards"("period", "period_start");
CREATE INDEX "photo_awards_photo_id_idx" ON "photo_awards"("photo_id");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_definition_id_fkey" FOREIGN KEY ("badge_definition_id") REFERENCES "badge_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_awarded_photo_id_fkey" FOREIGN KEY ("awarded_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_awards" ADD CONSTRAINT "photo_awards_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
