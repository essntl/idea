"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

/** Creates an empty draft and opens it in the editor. */
export function NewContentButton({ type, label, ghost }: { type: "blog" | "article"; label: string; ghost?: boolean }) {
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
          const { id } = await api<{ id: string }>(type === "blog" ? "/api/admin/blog" : "/api/admin/articles", { method: "POST" });
          router.push(`/admin/${type === "blog" ? "blog" : "articles"}/${id}`);
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
