-- AlterEnum
ALTER TYPE "PhotoVariantType" ADD VALUE 'thumbnail_16x9';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'community';
ALTER TYPE "ReportTargetType" ADD VALUE 'forum_post';

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "max_photo_long_edge" INTEGER NOT NULL DEFAULT 4096,
ADD COLUMN     "min_photo_long_edge" INTEGER NOT NULL DEFAULT 800;
