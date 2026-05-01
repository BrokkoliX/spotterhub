-- CreateTable
CREATE TABLE "ad_settings" (
    "id" TEXT NOT NULL DEFAULT 'ad_settings',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "adsense_client_id" TEXT NOT NULL DEFAULT 'ca-pub-XXXXXXXXXXXXXXXX',
    "ad_slot_feed" TEXT,
    "ad_slot_photo_detail" TEXT,
    "ad_slot_sidebar" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_settings_pkey" PRIMARY KEY ("id")
);
