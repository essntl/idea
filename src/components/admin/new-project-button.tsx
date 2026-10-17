"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PlusIcon } from "@/components/ui/icons";

type Mode = "repo" | "blank";

/** "New project": start blank, or from a GitHub repository (optionally written up by AI). */
export function NewProjectButton({ ai, autoOpen = false }: { ai: boolean; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [mode, setMode] = useState<Mode>("repo");
  const [url, setUrl] = useState("");
  const [useAi, setUseAi] = useState(ai);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; warnings: string[] } | null>(null);

  // Reading a repository (and especially an AI write-up) takes a while: say so after a few seconds.
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), 3000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [busy]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string; warnings: string[] }>("/api/admin/projects", {
        json: mode === "repo" ? { repoUrl: url, ai: ai && useAi } : {},
      });
      if (r.warnings.length) setDone(r);
      else router.push(`/admin/projects/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const progress = mode === "repo" ? (slow ? (ai && useAi ? "Reading the repository and writing the entry… this can take up to a minute." : "Reading the repository…") : "Creating…") : "Creating…";

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <PlusIcon width={18} height={18} /> New project
      </button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="New project"
        footer={
          done ? (
            <button type="button" className="btn flex-1" onClick={() => router.push(`/admin/projects/${done.id}`)}>
              Open project
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <span className="flex-1" />
              <button type="button" className="btn" onClick={() => void create()} disabled={busy || (mode === "repo" && !url.trim())}>
                {busy ? "Working…" : "Create project"}
              </button>
            </>
          )
        }
      >
        {done ? (
          <div className="space-y-2 pt-1">
            <p className="font-medium">The draft is ready, with a note:</p>
            {done.warnings.map((w) => (
              <p key={w} className="text-sm text-muted">
                {w}
              </p>
            ))}
          </div>
        ) : (
          <form
            className="space-y-5 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && (mode === "blank" || url.trim())) void create();
            }}
          >
            <div role="radiogroup" aria-label="Start from" className="flex gap-1.5">
              {(
                [
                  ["repo", "From a GitHub repository"],
                  ["blank", "Blank"],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} className="chip" onClick={() => setMode(m)}>
                  {label}
                </button>
              ))}
            </div>

            {mode === "repo" ? (
              <>
                <div>
                  <label htmlFor="np-repo" className="mb-1 block text-sm font-medium">
                    Repository
                  </label>
                  <input
                    id="np-repo"
                    className="field"
                    type="url"
                    inputMode="url"
                    placeholder="https://github.com/you/project"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    autoFocus
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs text-muted">
                    Fills in the name, summary, website, published package, stack, status and a write-up from the README. Private repositories need a <code>GITHUB_TOKEN</code>.
                  </p>
                </div>
                {ai ? (
                  <Switch
                    label="Write it with AI"
                    description="Reads the README and project files and writes the summary, stack, status and write-up for you."
                    checked={useAi}
                    onChange={setUseAi}
                    disabled={busy}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    Want it written for you? Turn on the AI assistant in{" "}
                    <Link href="/admin/settings" className="underline">
                      Settings
                    </Link>
                    .
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">An empty draft you fill in yourself.</p>
            )}

            {busy && (
              <p role="status" className="text-sm text-muted">
                {progress}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium">
                {error}
              </p>
            )}
            <button type="submit" hidden />
          </form>
        )}
      </Sheet>
    </>
  );
}
