-- AlterTable
ALTER TABLE "aircraft" ADD COLUMN     "aircraft_type_id" UUID;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "aircraft_type_id" UUID;

-- CreateTable
CREATE TABLE "aircraft_types" (
    "id" UUID NOT NULL,
    "iata_code" TEXT,
    "icao_code" TEXT,
    "manufacturer" TEXT NOT NULL,
    "aircraft_name" TEXT NOT NULL,
    "category" TEXT,
    "engine_type" TEXT,
    "engine_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircraft_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_types_iata_code_icao_code_key" ON "aircraft_types"("iata_code", "icao_code");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_aircraft_type_id_fkey" FOREIGN KEY ("aircraft_type_id") REFERENCES "aircraft_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_aircraft_type_id_fkey" FOREIGN KEY ("aircraft_type_id") REFERENCES "aircraft_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
