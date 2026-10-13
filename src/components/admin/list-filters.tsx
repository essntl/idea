/** GET form for list filtering; works without JavaScript. */
export function ListFilters({
  action,
  values,
  statuses,
  categories,
  tags,
}: {
  action: string;
  values: Record<string, string | undefined>;
  statuses: string[];
  categories?: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
}) {
  const sel = "field sm:w-auto";
  return (
    <form action={action} method="get" className="mb-6 grid gap-2 sm:flex sm:flex-wrap" role="search">
      <label className="sr-only" htmlFor="f-q">Search</label>
      <input id="f-q" name="q" type="search" defaultValue={values.q} placeholder="Search titles" className="field sm:w-56" />
      <label className="sr-only" htmlFor="f-status">Status</label>
      <select id="f-status" name="status" defaultValue={values.status ?? ""} className={sel}>
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
      {categories && (
        <>
          <label className="sr-only" htmlFor="f-cat">Category</label>
          <select id="f-cat" name="category" defaultValue={values.category ?? ""} className={sel}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </>
      )}
      <label className="sr-only" htmlFor="f-tag">Tag</label>
      <select id="f-tag" name="tag" defaultValue={values.tag ?? ""} className={sel}>
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.slug} value={t.slug}>{t.name}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-sort">Sort</label>
      <select id="f-sort" name="sort" defaultValue={values.sort ?? "updated"} className={sel}>
        <option value="updated">Recently edited</option>
        <option value="published">Publish date</option>
        <option value="title">Title</option>
      </select>
      <button type="submit" className="btn btn-ghost">Filter</button>
    </form>
  );
}
