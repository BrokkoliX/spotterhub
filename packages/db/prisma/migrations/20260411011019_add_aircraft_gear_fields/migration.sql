-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "aircraft_id" UUID,
ADD COLUMN     "gear_body" TEXT,
ADD COLUMN     "gear_lens" TEXT,
ADD COLUMN     "photographer_id" UUID,
ADD COLUMN     "photographer_name" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "camera_bodies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lenses" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "aircraft" (
    "id" UUID NOT NULL,
    "registration" TEXT NOT NULL,
    "aircraft_type" TEXT NOT NULL,
    "airline" TEXT,
    "msn" TEXT,
    "manufacturing_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_registration_key" ON "aircraft"("registration");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
