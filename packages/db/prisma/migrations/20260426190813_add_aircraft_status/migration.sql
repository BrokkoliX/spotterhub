-- CreateEnum
CREATE TYPE "AircraftStatus" AS ENUM ('active', 'pending_approval');

-- AlterTable
ALTER TABLE "aircraft" ADD COLUMN     "status" "AircraftStatus" NOT NULL DEFAULT 'active';
