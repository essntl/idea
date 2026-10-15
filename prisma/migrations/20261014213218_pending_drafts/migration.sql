-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);
