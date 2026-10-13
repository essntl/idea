"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { pickFiles } from "./editor/upload";

type Result = { filename: string; id: string; title: string; unresolvedImages: string[]; warnings: string[] };

/** Imports one or more .md files as drafts and lists what happened. */
export function ImportMarkdownButton({ type }: { type: "blog" | "article" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ results: Result[]; errors: { filename: string; error: string }[] } | null>(null);

  async function run() {
    const files = await pickFiles(".md,.markdown,text/markdown,text/plain", true);
    if (!files.length) return;
    const form = new FormData();
    form.set("type", type);
    for (const f of files) form.append("file", f);
    setBusy(true);
    try {
      const r = await api<{ results: Result[]; errors: { filename: string; error: string }[] }>("/api/admin/import/markdown", { body: form });
      setReport(r);
      router.refresh();
    } catch (e) {
      const data = (e as { data?: { results: Result[]; errors: { filename: string; error: string }[] } }).data;
      setReport(data?.errors ? data : { results: [], errors: [{ filename: "", error: (e as Error).message }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={run} disabled={busy}>
        {busy ? "Importing…" : "Import markdown"}
      </button>
      {report && (
        <div className="fixed inset-x-4 bottom-4 z-50 max-h-[60dvh] overflow-y-auto rounded border border-line-strong bg-bg p-4 text-sm sm:right-6 sm:left-auto sm:w-[28rem]" role="status">
          <div className="mb-2 flex items-center justify-between">
            <strong>Import finished</strong>
            <button type="button" className="tap px-2 underline" onClick={() => setReport(null)}>Close</button>
          </div>
          <ul className="space-y-2">
            {report.results.map((r) => (
              <li key={r.id}>
                ✓ <Link className="underline" href={`/admin/${type === "blog" ? "blog" : "articles"}/${r.id}`}>{r.title || r.filename}</Link>
                {r.unresolvedImages.length > 0 && <p className="text-muted">Needs images: {r.unresolvedImages.join(", ")}</p>}
                {r.warnings.map((w) => (
                  <p key={w} className="text-muted">{w}</p>
                ))}
              </li>
            ))}
            {report.errors.map((e) => (
              <li key={e.filename + e.error} className="font-medium">✗ {e.filename} — {e.error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
