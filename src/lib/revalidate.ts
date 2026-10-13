import "server-only";
import { revalidateTag } from "next/cache";
import { TAGS } from "./cache-tags";

/** Expire cached public data immediately after an admin change. */
export function revalidate(...tags: (keyof typeof TAGS)[]) {
  for (const t of tags.length ? tags : (["content"] as const)) revalidateTag(TAGS[t], { expire: 0 });
}
