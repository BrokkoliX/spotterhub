/*
  Warnings:

  - You are about to drop the column `approved` on the `seller_profiles` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "seller_profiles" DROP COLUMN "approved",
ADD COLUMN     "status" "SellerStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "marketplace_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_items" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "condition" TEXT NOT NULL,
    "location" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "moderation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_item_images" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_type" "PhotoVariantType" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "file_size_bytes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_feedback" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "item_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_categories_name_key" ON "marketplace_categories"("name");

-- CreateIndex
CREATE INDEX "marketplace_items_seller_id_idx" ON "marketplace_items"("seller_id");

-- CreateIndex
CREATE INDEX "marketplace_items_user_id_idx" ON "marketplace_items"("user_id");

-- CreateIndex
CREATE INDEX "marketplace_items_category_id_idx" ON "marketplace_items"("category_id");

-- CreateIndex
CREATE INDEX "marketplace_items_moderation_status_idx" ON "marketplace_items"("moderation_status");

-- CreateIndex
CREATE INDEX "marketplace_item_images_item_id_idx" ON "marketplace_item_images"("item_id");

-- CreateIndex
CREATE INDEX "seller_feedback_seller_id_idx" ON "seller_feedback"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_feedback_buyer_id_seller_id_key" ON "seller_feedback"("buyer_id", "seller_id");

-- AddForeignKey
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "marketplace_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_item_images" ADD CONSTRAINT "marketplace_item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "marketplace_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_feedback" ADD CONSTRAINT "seller_feedback_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_feedback" ADD CONSTRAINT "seller_feedback_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_feedback" ADD CONSTRAINT "seller_feedback_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "marketplace_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
