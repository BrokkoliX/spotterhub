-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('AIRCRAFT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "CommunityPhotoCategory" AS ENUM ('SCENERY', 'EVENT', 'HANGAR', 'AIRPORT', 'PEOPLE', 'OTHER');

-- AlterTable
ALTER TABLE "photos" ADD COLUMN "kind" "PhotoKind" NOT NULL DEFAULT 'AIRCRAFT',
ADD COLUMN "community_category" "CommunityPhotoCategory";

-- CreateIndex
CREATE INDEX "photos_kind_idx" ON "photos"("kind");
