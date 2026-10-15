-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "blogPostId" TEXT,
ALTER COLUMN "articleId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Comment_blogPostId_createdAt_idx" ON "Comment"("blogPostId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every comment belongs to exactly one article or one blog post.
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_single_target_check"
  CHECK (("articleId" IS NOT NULL)::int + ("blogPostId" IS NOT NULL)::int = 1);
