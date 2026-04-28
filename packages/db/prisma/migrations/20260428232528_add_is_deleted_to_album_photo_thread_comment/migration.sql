-- AlterEnum
ALTER TYPE "CommunityModerationAction" ADD VALUE 'delete_album';

-- AlterTable
ALTER TABLE "albums" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "forum_threads" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
