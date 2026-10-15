"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

const ROUTES = {
  blog: { api: "/api/admin/blog", edit: "/admin/blog" },
  article: { api: "/api/admin/articles", edit: "/admin/articles" },
  project: { api: "/api/admin/projects", edit: "/admin/projects" },
} as const;

export type NewContentType = keyof typeof ROUTES;

/** Creates an empty draft and returns the editor URL. */
export async function createContent(type: NewContentType) {
  const { id } = await api<{ id: string }>(ROUTES[type].api, { method: "POST" });
  return `${ROUTES[type].edit}/${id}`;
}

/** Creates an empty draft and opens it in the editor. */
export function NewContentButton({ type, label, ghost }: { type: NewContentType; label: string; ghost?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${ghost ? "btn-ghost" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          router.push(await createContent(type));
        } catch (e) {
          alert((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? "Creating…" : label}
    </button>
  );
}
