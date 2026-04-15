/*
  Warnings:

  - You are about to drop the column `aircraft_name` on the `aircraft_types` table. All the data in the column will be lost.
  - You are about to drop the column `manufacturer` on the `aircraft_types` table. All the data in the column will be lost.
  - Added the required column `model` to the `aircraft_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor` to the `aircraft_types` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "aircraft_types" DROP COLUMN "aircraft_name",
DROP COLUMN "manufacturer",
ADD COLUMN     "model" TEXT NOT NULL,
ADD COLUMN     "vendor" TEXT NOT NULL;
