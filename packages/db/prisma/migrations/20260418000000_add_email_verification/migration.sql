-- Idempotent migration: bring production DB in sync with squashed init migration
-- Safe to run against a DB with partial or complete schema

-- ============================================================================
-- Extensions & Schema (already idempotent)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- Enums (wrapped in DO blocks with existence checks)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin', 'superuser');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
        CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'banned');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExperienceLevel') THEN
        CREATE TYPE "ExperienceLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationPrivacyMode') THEN
        CREATE TYPE "LocationPrivacyMode" AS ENUM ('exact', 'approximate', 'hidden');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationStatus') THEN
        CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected', 'review');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhotoVariantType') THEN
        CREATE TYPE "PhotoVariantType" AS ENUM ('thumbnail', 'display', 'full_res', 'watermarked');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
        CREATE TYPE "NotificationType" AS ENUM ('like', 'comment', 'follow', 'mention', 'moderation', 'system', 'community_join', 'community_event');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportTargetType') THEN
        CREATE TYPE "ReportTargetType" AS ENUM ('photo', 'comment', 'profile', 'album');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportReason') THEN
        CREATE TYPE "ReportReason" AS ENUM ('inappropriate', 'spam', 'harassment', 'copyright', 'other');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportStatus') THEN
        CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewed', 'resolved', 'dismissed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FollowTargetType') THEN
        CREATE TYPE "FollowTargetType" AS ENUM ('user', 'airport', 'manufacturer', 'family', 'variant');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityRole') THEN
        CREATE TYPE "CommunityRole" AS ENUM ('owner', 'admin', 'moderator', 'member');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityMemberStatus') THEN
        CREATE TYPE "CommunityMemberStatus" AS ENUM ('active', 'pending', 'banned');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityVisibility') THEN
        CREATE TYPE "CommunityVisibility" AS ENUM ('public', 'invite_only');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityTier') THEN
        CREATE TYPE "CommunityTier" AS ENUM ('free', 'standard', 'large', 'enterprise');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OperatorType') THEN
        CREATE TYPE "OperatorType" AS ENUM ('airline', 'general_aviation', 'military', 'government', 'cargo', 'charter', 'private');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventRsvpStatus') THEN
        CREATE TYPE "EventRsvpStatus" AS ENUM ('going', 'maybe', 'not_going');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityModerationAction') THEN
        CREATE TYPE "CommunityModerationAction" AS ENUM ('ban', 'unban', 'kick', 'pin_thread', 'unpin_thread', 'lock_thread', 'unlock_thread', 'delete_post', 'delete_photo', 'delete_comment');
    END IF;
END $$;

-- ============================================================================
-- Tables (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "aircraft_manufacturers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aircraft_manufacturers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aircraft_families" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aircraft_families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aircraft_variants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "iata_code" TEXT,
    "icao_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aircraft_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "airlines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icao_code" TEXT,
    "iata_code" TEXT,
    "country" TEXT,
    "callsign" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "airlines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "photo_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photo_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aircraft_specific_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aircraft_specific_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pending_list_items" (
    "id" UUID NOT NULL,
    "listType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "metadata" JSONB,
    "submitted_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pending_list_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "cognito_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "location_region" TEXT,
    "camera_bodies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience_level" "ExperienceLevel",
    "gear" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favorite_aircraft" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favorite_airports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "follows" (
    "id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "target_type" "FollowTargetType" NOT NULL,
    "following_id" UUID,
    "airport_id" UUID,
    "target_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "albums" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "community_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_photo_id" UUID,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "album_id" UUID,
    "caption" TEXT,
    "airline" TEXT,
    "airport_code" TEXT,
    "taken_at" TIMESTAMP(3),
    "original_url" TEXT NOT NULL,
    "original_width" INTEGER,
    "original_height" INTEGER,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "moderation_labels" JSONB,
    "moderation_confidence" DOUBLE PRECISION,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "aircraft_id" UUID,
    "photographer_id" UUID,
    "photographer_name" TEXT,
    "gear_body" TEXT,
    "gear_lens" TEXT,
    "exif_data" JSONB,
    "photo_category_id" UUID,
    "aircraft_specific_category_id" UUID,
    "operator_icao" TEXT,
    "operator_type" "OperatorType",
    "msn" TEXT,
    "manufacturing_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "photo_variants" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "variant_type" "PhotoVariantType" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photo_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "photo_tags" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photo_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aircraft" (
    "id" UUID NOT NULL,
    "registration" TEXT NOT NULL,
    "airline" TEXT,
    "msn" TEXT,
    "manufacturing_date" TIMESTAMP(3),
    "manufacturer_id" UUID,
    "family_id" UUID,
    "variant_id" UUID,
    "operator_type" "OperatorType",
    "airline_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aircraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "photo_locations" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "raw_latitude" DOUBLE PRECISION,
    "raw_longitude" DOUBLE PRECISION,
    "display_latitude" DOUBLE PRECISION NOT NULL,
    "display_longitude" DOUBLE PRECISION NOT NULL,
    "privacy_mode" "LocationPrivacyMode" NOT NULL DEFAULT 'exact',
    "airport_id" UUID,
    "spotting_location_id" UUID,
    "location_type" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "photo_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "airports" (
    "id" UUID NOT NULL,
    "icao_code" TEXT NOT NULL,
    "iata_code" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "spotting_locations" (
    "id" UUID NOT NULL,
    "airport_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "access_notes" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "spotting_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "photo_id" UUID,
    "album_id" UUID,
    "parent_comment_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "likes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "photo_id" UUID,
    "album_id" UUID,
    "comment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "communities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "banner_url" TEXT,
    "avatar_url" TEXT,
    "category" TEXT,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'public',
    "invite_code" TEXT,
    "location" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "community_members" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'member',
    "status" "CommunityMemberStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "community_subscriptions" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "stripe_sub_id" TEXT,
    "tier" "CommunityTier" NOT NULL DEFAULT 'free',
    "billing_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_categories" (
    "id" UUID NOT NULL,
    "community_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_threads" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_post_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_posts" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_post_id" UUID,
    "body" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "community_events" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "max_attendees" INTEGER,
    "cover_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "event_attendees" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'going',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "album_photos" (
    "album_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "album_photos_pkey" PRIMARY KEY ("album_id","photo_id")
);

CREATE TABLE IF NOT EXISTS "community_moderation_logs" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "action" "CommunityModerationAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_moderation_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'site_settings',
    "banner_url" TEXT,
    "tagline" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Add missing columns (ADD COLUMN IF NOT EXISTS for each column in each table)
-- ============================================================================

-- aircraft_manufacturers
ALTER TABLE "aircraft_manufacturers" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "aircraft_manufacturers" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "aircraft_manufacturers" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "aircraft_manufacturers" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- aircraft_families
ALTER TABLE "aircraft_families" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "aircraft_families" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "aircraft_families" ADD COLUMN IF NOT EXISTS "manufacturer_id" UUID NOT NULL;
ALTER TABLE "aircraft_families" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- aircraft_variants
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "family_id" UUID NOT NULL;
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "iata_code" TEXT;
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "icao_code" TEXT;
ALTER TABLE "aircraft_variants" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- airlines
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "icao_code" TEXT;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "iata_code" TEXT;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "callsign" TEXT;
ALTER TABLE "airlines" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- photo_categories
ALTER TABLE "photo_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "photo_categories" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "photo_categories" ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL;
ALTER TABLE "photo_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "photo_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- aircraft_specific_categories
ALTER TABLE "aircraft_specific_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "aircraft_specific_categories" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "aircraft_specific_categories" ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL;
ALTER TABLE "aircraft_specific_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "aircraft_specific_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- pending_list_items
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "listType" TEXT NOT NULL;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "value" TEXT NOT NULL;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "submitted_by" UUID NOT NULL;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "reviewed_by" UUID;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "pending_list_items" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cognito_sub" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "location_region" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "camera_bodies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lenses" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "experience_level" "ExperienceLevel";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "gear" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favorite_aircraft" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favorite_airports" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- follows
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "follower_id" UUID NOT NULL;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "target_type" "FollowTargetType" NOT NULL;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "following_id" UUID;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "airport_id" UUID;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "target_value" TEXT;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- albums
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "community_id" UUID;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "cover_photo_id" UUID;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- photos
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "album_id" UUID;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "airline" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "airport_code" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "taken_at" TIMESTAMP(3);
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "original_url" TEXT NOT NULL;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "original_width" INTEGER;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "original_height" INTEGER;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "moderation_labels" JSONB;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "moderation_confidence" DOUBLE PRECISION;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "like_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "aircraft_id" UUID;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "photographer_id" UUID;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "photographer_name" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "gear_body" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "gear_lens" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "exif_data" JSONB;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "photo_category_id" UUID;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "aircraft_specific_category_id" UUID;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "operator_icao" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "operator_type" "OperatorType";
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "msn" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "manufacturing_date" TEXT;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- photo_variants
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "photo_id" UUID NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "variant_type" "PhotoVariantType" NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "width" INTEGER NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "height" INTEGER NOT NULL;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER;
ALTER TABLE "photo_variants" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- photo_tags
ALTER TABLE "photo_tags" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "photo_tags" ADD COLUMN IF NOT EXISTS "photo_id" UUID NOT NULL;
ALTER TABLE "photo_tags" ADD COLUMN IF NOT EXISTS "tag" TEXT NOT NULL;
ALTER TABLE "photo_tags" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- aircraft
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "registration" TEXT NOT NULL;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "airline" TEXT;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "msn" TEXT;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "manufacturing_date" TIMESTAMP(3);
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "manufacturer_id" UUID;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "family_id" UUID;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "variant_id" UUID;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "operator_type" "OperatorType";
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "airline_id" UUID;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "aircraft" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- photo_locations
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "photo_id" UUID NOT NULL;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "raw_latitude" DOUBLE PRECISION;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "raw_longitude" DOUBLE PRECISION;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "display_latitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "display_longitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "privacy_mode" "LocationPrivacyMode" NOT NULL DEFAULT 'exact';
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "airport_id" UUID;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "spotting_location_id" UUID;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "location_type" TEXT;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "photo_locations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- airports
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "icao_code" TEXT NOT NULL;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "iata_code" TEXT;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- spotting_locations
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "airport_id" UUID;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "access_notes" TEXT;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION NOT NULL;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "created_by" UUID NOT NULL;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "spotting_locations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- comments
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "photo_id" UUID;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "album_id" UUID;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" UUID;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- likes
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "photo_id" UUID;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "album_id" UUID;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "comment_id" UUID;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reporter_id" UUID NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_type" "ReportTargetType" NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_id" UUID NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reason" "ReportReason" NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "status" "ReportStatus" NOT NULL DEFAULT 'open';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reviewed_by" UUID;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

-- notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" "NotificationType" NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- communities
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "visibility" "CommunityVisibility" NOT NULL DEFAULT 'public';
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "invite_code" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "owner_id" UUID NOT NULL;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- community_members
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "community_id" UUID NOT NULL;
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "role" "CommunityRole" NOT NULL DEFAULT 'member';
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "status" "CommunityMemberStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- community_subscriptions
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "community_id" UUID NOT NULL;
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_sub_id" TEXT;
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "tier" "CommunityTier" NOT NULL DEFAULT 'free';
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "billing_status" TEXT;
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "community_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- forum_categories
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "community_id" UUID;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- forum_threads
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "category_id" UUID NOT NULL;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "author_id" UUID NOT NULL;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "post_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "last_post_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- forum_posts
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "thread_id" UUID NOT NULL;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "author_id" UUID NOT NULL;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "parent_post_id" UUID;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- community_events
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "community_id" UUID NOT NULL;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "organizer_id" UUID NOT NULL;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "starts_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "ends_at" TIMESTAMP(3);
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "max_attendees" INTEGER;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "cover_url" TEXT;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "community_events" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- event_attendees
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "event_id" UUID NOT NULL;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "status" "EventRsvpStatus" NOT NULL DEFAULT 'going';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- album_photos
ALTER TABLE "album_photos" ADD COLUMN IF NOT EXISTS "album_id" UUID NOT NULL;
ALTER TABLE "album_photos" ADD COLUMN IF NOT EXISTS "photo_id" UUID NOT NULL;
ALTER TABLE "album_photos" ADD COLUMN IF NOT EXISTS "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- community_moderation_logs
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "community_id" UUID NOT NULL;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "moderator_id" UUID NOT NULL;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "target_user_id" UUID NOT NULL;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "action" "CommunityModerationAction" NOT NULL;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "community_moderation_logs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- site_settings
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT 'site_settings';
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL;

-- password_reset_tokens
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "token" TEXT NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP(3);
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- Indexes (CREATE INDEX IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "aircraft_manufacturers_name_key" ON "aircraft_manufacturers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "aircraft_families_name_key" ON "aircraft_families"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "aircraft_variants_name_key" ON "aircraft_variants"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "airlines_icao_code_key" ON "airlines"("icao_code");
CREATE UNIQUE INDEX IF NOT EXISTS "airlines_iata_code_key" ON "airlines"("iata_code");
CREATE UNIQUE INDEX IF NOT EXISTS "photo_categories_name_key" ON "photo_categories"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "aircraft_specific_categories_name_key" ON "aircraft_specific_categories"("name");
CREATE INDEX IF NOT EXISTS "pending_list_items_submitted_by_idx" ON "pending_list_items"("submitted_by");
CREATE INDEX IF NOT EXISTS "pending_list_items_reviewed_by_idx" ON "pending_list_items"("reviewed_by");
CREATE UNIQUE INDEX IF NOT EXISTS "users_cognito_sub_key" ON "users"("cognito_sub");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_id_key" ON "profiles"("user_id");
CREATE INDEX IF NOT EXISTS "follows_target_type_following_id_idx" ON "follows"("target_type", "following_id");
CREATE INDEX IF NOT EXISTS "follows_target_type_airport_id_idx" ON "follows"("target_type", "airport_id");
CREATE INDEX IF NOT EXISTS "follows_target_type_target_value_idx" ON "follows"("target_type", "target_value");
CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_id_target_type_following_id_key" ON "follows"("follower_id", "target_type", "following_id");
CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_id_target_type_airport_id_key" ON "follows"("follower_id", "target_type", "airport_id");
CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_id_target_type_target_value_key" ON "follows"("follower_id", "target_type", "target_value");
CREATE INDEX IF NOT EXISTS "photos_photo_category_id_idx" ON "photos"("photo_category_id");
CREATE INDEX IF NOT EXISTS "photos_aircraft_specific_category_id_idx" ON "photos"("aircraft_specific_category_id");
CREATE INDEX IF NOT EXISTS "photos_aircraft_id_idx" ON "photos"("aircraft_id");
CREATE INDEX IF NOT EXISTS "photo_tags_tag_idx" ON "photo_tags"("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "aircraft_registration_key" ON "aircraft"("registration");
CREATE INDEX IF NOT EXISTS "aircraft_manufacturer_id_idx" ON "aircraft"("manufacturer_id");
CREATE INDEX IF NOT EXISTS "aircraft_family_id_idx" ON "aircraft"("family_id");
CREATE INDEX IF NOT EXISTS "aircraft_variant_id_idx" ON "aircraft"("variant_id");
CREATE INDEX IF NOT EXISTS "aircraft_airline_id_idx" ON "aircraft"("airline_id");
CREATE UNIQUE INDEX IF NOT EXISTS "photo_locations_photo_id_key" ON "photo_locations"("photo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "airports_icao_code_key" ON "airports"("icao_code");
CREATE UNIQUE INDEX IF NOT EXISTS "airports_iata_code_key" ON "airports"("iata_code");
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_id_photo_id_key" ON "likes"("user_id", "photo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_id_album_id_key" ON "likes"("user_id", "album_id");
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_id_comment_id_key" ON "likes"("user_id", "comment_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE UNIQUE INDEX IF NOT EXISTS "communities_slug_key" ON "communities"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "communities_invite_code_key" ON "communities"("invite_code");
CREATE UNIQUE INDEX IF NOT EXISTS "community_members_community_id_user_id_key" ON "community_members"("community_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "community_subscriptions_community_id_key" ON "community_subscriptions"("community_id");
CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_community_id_slug_key" ON "forum_categories"("community_id", "slug");
CREATE INDEX IF NOT EXISTS "forum_threads_category_id_last_post_at_idx" ON "forum_threads"("category_id", "last_post_at" DESC);
CREATE INDEX IF NOT EXISTS "forum_posts_thread_id_created_at_idx" ON "forum_posts"("thread_id", "created_at");
CREATE INDEX IF NOT EXISTS "community_events_community_id_starts_at_idx" ON "community_events"("community_id", "starts_at");
CREATE UNIQUE INDEX IF NOT EXISTS "event_attendees_event_id_user_id_key" ON "event_attendees"("event_id", "user_id");
CREATE INDEX IF NOT EXISTS "album_photos_photo_id_idx" ON "album_photos"("photo_id");
CREATE INDEX IF NOT EXISTS "community_moderation_logs_community_id_created_at_idx" ON "community_moderation_logs"("community_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "community_moderation_logs_community_id_moderator_id_idx" ON "community_moderation_logs"("community_id", "moderator_id");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- ============================================================================
-- Foreign Keys (wrapped in DO blocks with existence checks)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_families_manufacturer_id_fkey') THEN
        ALTER TABLE "aircraft_families" ADD CONSTRAINT "aircraft_families_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "aircraft_manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_variants_family_id_fkey') THEN
        ALTER TABLE "aircraft_variants" ADD CONSTRAINT "aircraft_variants_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "aircraft_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_list_items_submitted_by_fkey') THEN
        ALTER TABLE "pending_list_items" ADD CONSTRAINT "pending_list_items_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_list_items_reviewed_by_fkey') THEN
        ALTER TABLE "pending_list_items" ADD CONSTRAINT "pending_list_items_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey') THEN
        ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_follower_id_fkey') THEN
        ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_following_id_fkey') THEN
        ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_airport_id_fkey') THEN
        ALTER TABLE "follows" ADD CONSTRAINT "follows_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_user_id_fkey') THEN
        ALTER TABLE "albums" ADD CONSTRAINT "albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_community_id_fkey') THEN
        ALTER TABLE "albums" ADD CONSTRAINT "albums_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_cover_photo_id_fkey') THEN
        ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_photo_id_fkey" FOREIGN KEY ("cover_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_user_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_album_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_aircraft_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_photographer_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_photo_category_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "photo_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_aircraft_specific_category_id_fkey') THEN
        ALTER TABLE "photos" ADD CONSTRAINT "photos_aircraft_specific_category_id_fkey" FOREIGN KEY ("aircraft_specific_category_id") REFERENCES "aircraft_specific_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_variants_photo_id_fkey') THEN
        ALTER TABLE "photo_variants" ADD CONSTRAINT "photo_variants_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_tags_photo_id_fkey') THEN
        ALTER TABLE "photo_tags" ADD CONSTRAINT "photo_tags_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_manufacturer_id_fkey') THEN
        ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "aircraft_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_family_id_fkey') THEN
        ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "aircraft_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_variant_id_fkey') THEN
        ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "aircraft_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aircraft_airline_id_fkey') THEN
        ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_airline_id_fkey" FOREIGN KEY ("airline_id") REFERENCES "airlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_locations_photo_id_fkey') THEN
        ALTER TABLE "photo_locations" ADD CONSTRAINT "photo_locations_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_locations_airport_id_fkey') THEN
        ALTER TABLE "photo_locations" ADD CONSTRAINT "photo_locations_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_locations_spotting_location_id_fkey') THEN
        ALTER TABLE "photo_locations" ADD CONSTRAINT "photo_locations_spotting_location_id_fkey" FOREIGN KEY ("spotting_location_id") REFERENCES "spotting_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spotting_locations_airport_id_fkey') THEN
        ALTER TABLE "spotting_locations" ADD CONSTRAINT "spotting_locations_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spotting_locations_created_by_fkey') THEN
        ALTER TABLE "spotting_locations" ADD CONSTRAINT "spotting_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_user_id_fkey') THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_photo_id_fkey') THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_album_id_fkey') THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_parent_comment_id_fkey') THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_user_id_fkey') THEN
        ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_photo_id_fkey') THEN
        ALTER TABLE "likes" ADD CONSTRAINT "likes_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_album_id_fkey') THEN
        ALTER TABLE "likes" ADD CONSTRAINT "likes_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_comment_id_fkey') THEN
        ALTER TABLE "likes" ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_reporter_id_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_reviewed_by_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_owner_id_fkey') THEN
        ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_members_community_id_fkey') THEN
        ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_members_user_id_fkey') THEN
        ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_subscriptions_community_id_fkey') THEN
        ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_categories_community_id_fkey') THEN
        ALTER TABLE "forum_categories" ADD CONSTRAINT "forum_categories_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_threads_category_id_fkey') THEN
        ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_threads_author_id_fkey') THEN
        ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_thread_id_fkey') THEN
        ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_author_id_fkey') THEN
        ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_parent_post_id_fkey') THEN
        ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_community_id_fkey') THEN
        ALTER TABLE "community_events" ADD CONSTRAINT "community_events_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_organizer_id_fkey') THEN
        ALTER TABLE "community_events" ADD CONSTRAINT "community_events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_attendees_event_id_fkey') THEN
        ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_attendees_user_id_fkey') THEN
        ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'album_photos_album_id_fkey') THEN
        ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'album_photos_photo_id_fkey') THEN
        ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_moderation_logs_community_id_fkey') THEN
        ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_moderation_logs_moderator_id_fkey') THEN
        ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_moderation_logs_target_user_id_fkey') THEN
        ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_id_fkey') THEN
        ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
