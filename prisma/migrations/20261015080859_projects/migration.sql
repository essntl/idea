-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('planning', 'building', 'live', 'paused', 'archived');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "contentJson" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "phase" "ProjectPhase" NOT NULL DEFAULT 'building',
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "repoUrl" TEXT,
    "siteUrl" TEXT,
    "packageUrl" TEXT,
    "stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "previewImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "draft" JSONB,
    "draftUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_publishedAt_idx" ON "Project"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_projectId_idx" ON "Article"("projectId");

-- CreateIndex
CREATE INDEX "BlogPost_projectId_idx" ON "BlogPost"("projectId");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_previewImageId_fkey" FOREIGN KEY ("previewImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
