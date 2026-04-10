-- CreateEnum
CREATE TYPE "CommunityModerationAction" AS ENUM ('ban', 'unban', 'kick', 'pin_thread', 'unpin_thread', 'lock_thread', 'unlock_thread', 'delete_post');

-- CreateTable
CREATE TABLE "community_moderation_logs" (
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

-- CreateIndex
CREATE INDEX "community_moderation_logs_community_id_created_at_idx" ON "community_moderation_logs"("community_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "community_moderation_logs_community_id_moderator_id_idx" ON "community_moderation_logs"("community_id", "moderator_id");

-- AddForeignKey
ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_moderation_logs" ADD CONSTRAINT "community_moderation_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
