import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listArticles, listBlogPosts, listProjects } from "@/lib/queries";
import { ArticleList } from "@/components/site/article-list";
import { ProjectGrid } from "@/components/site/projects/project-card";
import { BlogList } from "@/components/site/blog-list";
import { ArrowRight } from "@/components/ui/icons";

export default async function HomePage() {
  const [settings, articles, posts, projects] = await Promise.all([
    getSettings(),
    listArticles({ page: 1, perPage: 4 }),
    listBlogPosts({ page: 1, perPage: 5 }),
    listProjects(),
  ]);
  return (
    <div className="container-wide">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{settings.siteTitle}</h1>
        {settings.siteDescription && <p className="mt-3 text-lg text-muted">{settings.siteDescription}</p>}
      </section>

      {projects.length > 0 && (
        <section className="mt-14" aria-labelledby="projects-title">
          <div className="mb-6 flex items-baseline justify-between border-b border-line pb-3">
            <h2 id="projects-title" className="text-sm font-medium uppercase tracking-wider text-muted">Projects</h2>
            <Link href="/projects" className="tap justify-end gap-1.5 text-sm hover:underline">
              All projects <ArrowRight width={14} height={14} />
            </Link>
          </div>
          {/* Featured projects come first in the list. */}
          <ProjectGrid items={projects.slice(0, 4)} />
        </section>
      )}

      <section className="mt-16" aria-labelledby="latest-articles">
        <div className="mb-6 flex items-baseline justify-between border-b border-line pb-3">
          <h2 id="latest-articles" className="text-sm font-medium uppercase tracking-wider text-muted">Latest articles</h2>
          <Link href="/articles" className="tap justify-end gap-1.5 text-sm hover:underline">
            All articles <ArrowRight width={14} height={14} />
          </Link>
        </div>
        <ArticleList items={articles.items} priorityFirst />
      </section>

      <section className="mt-16 max-w-2xl" aria-labelledby="latest-posts">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="latest-posts" className="text-sm font-medium uppercase tracking-wider text-muted">From the blog</h2>
          <Link href="/blog" className="tap justify-end gap-1.5 text-sm hover:underline">
            All posts <ArrowRight width={14} height={14} />
          </Link>
        </div>
        <BlogList items={posts.items} />
      </section>
    </div>
  );
}
