-- Full-text search indexes (expression indexes; queries in src/lib/search.ts must use the same expressions).
CREATE INDEX "Article_search_idx" ON "Article" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("excerpt", '') || ' ' || coalesce("contentText", ''))
);
CREATE INDEX "BlogPost_search_idx" ON "BlogPost" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("contentText", ''))
);
