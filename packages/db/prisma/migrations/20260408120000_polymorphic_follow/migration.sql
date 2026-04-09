-- CreateEnum
CREATE TYPE "FollowTargetType" AS ENUM ('user', 'airport', 'aircraft_type', 'manufacturer');

-- AlterTable: drop old unique constraint/index, make followingId nullable, add new columns
DROP INDEX IF EXISTS "follows_follower_id_following_id_key";
ALTER TABLE "follows" ALTER COLUMN "following_id" DROP NOT NULL;
ALTER TABLE "follows" ADD COLUMN "target_type" "FollowTargetType" NOT NULL DEFAULT 'user';
ALTER TABLE "follows" ADD COLUMN "airport_id" UUID;
ALTER TABLE "follows" ADD COLUMN "target_value" TEXT;

-- Set target_type for existing rows (all are user follows)
UPDATE "follows" SET "target_type" = 'user';

-- Remove the default now that existing rows are backfilled
ALTER TABLE "follows" ALTER COLUMN "target_type" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_target_type_following_id_key" ON "follows"("follower_id", "target_type", "following_id");
CREATE UNIQUE INDEX "follows_follower_id_target_type_airport_id_key" ON "follows"("follower_id", "target_type", "airport_id");
CREATE UNIQUE INDEX "follows_follower_id_target_type_target_value_key" ON "follows"("follower_id", "target_type", "target_value");
CREATE INDEX "follows_target_type_following_id_idx" ON "follows"("target_type", "following_id");
CREATE INDEX "follows_target_type_airport_id_idx" ON "follows"("target_type", "airport_id");
CREATE INDEX "follows_target_type_target_value_idx" ON "follows"("target_type", "target_value");
