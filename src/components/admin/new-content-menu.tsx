"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Menu } from "@/components/ui/menu";
import { PlusIcon } from "@/components/ui/icons";

/** "+ New" button with a choice of blog post or article; creates the draft and opens it. */
export function NewContentMenu() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create(type: "blog" | "article") {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(type === "blog" ? "/api/admin/blog" : "/api/admin/articles", { method: "POST" });
      router.push(`/admin/${type === "blog" ? "blog" : "articles"}/${id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Menu
      label="Create new"
      className="!bg-fg px-4 font-medium !text-bg hover:opacity-85"
      trigger={
        <span className="flex items-center gap-1.5 text-[0.9375rem]">
          <PlusIcon width={18} height={18} /> {busy ? "Creating…" : "New"}
        </span>
      }
      items={[
        { label: "Blog post", onSelect: () => void create("blog") },
        { label: "Article", onSelect: () => void create("article") },
      ]}
    />
  );
}
