"use client";

import { useRouter } from "next/navigation";
import { Select, type SelectOption } from "@/components/ui/select";

/** Comment moderation: narrow the list to one article or blog post. */
export function PostFilter({ filter, value, options }: { filter: string; value: string; options: SelectOption[] }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Filter by post"
      className="field md:w-64"
      value={value}
      onChange={(v) => router.push(`/admin/comments?filter=${filter}${v ? `&post=${encodeURIComponent(v)}` : ""}`)}
      options={[{ value: "", label: "All posts" }, ...options]}
    />
  );
}
