-- AlterTable
ALTER TABLE "communities" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "communities" ADD COLUMN "invite_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "communities_invite_code_key" ON "communities"("invite_code");

-- Remove default after adding the column
ALTER TABLE "communities" ALTER COLUMN "slug" DROP DEFAULT;
