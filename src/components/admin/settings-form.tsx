"use client";

import { signOut } from "next-auth/react";
import { useId, useState } from "react";
import type { Settings } from "@/lib/settings";
import { api } from "./api";
import { pickFiles } from "./editor/upload";
import { ActionBar } from "./action-bar";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Label (+ help) and control; side by side from `sm`, stacked on phones. */
function Field({ label, help, children, htmlFor }: { label: string; help?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-6">
      <div className="sm:pt-2.5">
        <label htmlFor={htmlFor} className="text-[0.9375rem] font-medium">
          {label}
        </label>
        {help && <p className="mt-0.5 hidden text-xs text-muted sm:block">{help}</p>}
      </div>
      <div>
        {children}
        {help && <p className="mt-1 text-xs text-muted sm:hidden">{help}</p>}
      </div>
    </div>
  );
}

const githubUser = (url: string) => url.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)/i)?.[1] ?? null;

const Status = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "font-medium"}`}>
      {msg.text}
    </p>
  ) : null;

export function SettingsForm({
  initial,
  envCaptcha,
  captchaKeys,
  githubToken,
  aiKey,
}: {
  initial: Settings;
  envCaptcha: "turnstile" | "recaptcha";
  captchaKeys: { turnstile: boolean; recaptcha: boolean };
  githubToken: boolean;
  aiKey: AiKeyStatus;
}) {
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const provider = s.captchaProvider ?? envCaptcha;
  const keysOk = captchaKeys[provider];

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const next = await api<Settings>("/api/admin/settings", { method: "PUT", json: s });
      setS(next);
      setSaved(next);
      setMsg({ ok: true, text: "Settings saved" });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5 pb-24">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card title="Site" description="How your site introduces itself in the header, search results and feeds.">
          <Field label="Site title" htmlFor="siteTitle">
            <input id="siteTitle" className="field" value={s.siteTitle} onChange={(e) => set("siteTitle", e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="siteDescription" help="Shown on the home page and in search results.">
            <textarea id="siteDescription" className="field min-h-20" value={s.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Author name" htmlFor="authorName" help="Used as the byline and on your comment replies.">
            <input id="authorName" className="field" value={s.authorName} onChange={(e) => set("authorName", e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Items per page" htmlFor="postsPerPage">
            <input id="postsPerPage" type="number" inputMode="numeric" min={3} max={100} className="field w-28" value={s.postsPerPage} onChange={(e) => set("postsPerPage", Number(e.target.value))} />
          </Field>
        </Card>

        <Card title="Footer links" description="Shown at the bottom of every page.">
          <Field label="Portfolio" htmlFor="portfolioUrl">
            <input id="portfolioUrl" type="url" inputMode="url" className="field" value={s.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail">
            <input id="contactEmail" type="email" inputMode="email" className="field" value={s.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </Field>
          <Field label="GitHub" htmlFor="githubUrl">
            <input id="githubUrl" type="url" inputMode="url" className="field" value={s.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} placeholder="https://github.com/…" />
          </Field>
          <Field label="Other links" help="E.g. Mastodon, LinkedIn. Up to 10.">
            <div className="space-y-2">
              {s.socialLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="field w-28 shrink-0 sm:w-32" aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} onChange={(e) => set("socialLinks", s.socialLinks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="field min-w-0" aria-label={`Link ${i + 1} URL`} type="url" placeholder="https://" value={l.url} onChange={(e) => set("socialLinks", s.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <button type="button" className="btn-quiet shrink-0" onClick={() => set("socialLinks", s.socialLinks.filter((_, j) => j !== i))} aria-label={`Remove link ${i + 1}`}>
                    <CloseIcon width={16} height={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-quiet -ml-2.5" onClick={() => set("socialLinks", [...s.socialLinks, { label: "", url: "https://" }])} disabled={s.socialLinks.length >= 10}>
                <PlusIcon width={16} height={16} /> Add link
              </button>
            </div>
          </Field>
        </Card>

        <Card title="Projects" description="The Projects page lists your projects and, optionally, your GitHub activity.">
          <Switch
            label="Show GitHub activity"
            description={
              githubUser(s.githubUrl)
                ? `Profile, contribution graph and streaks for @${githubUser(s.githubUrl)} (from the GitHub link above).`
                : "Add your GitHub profile link above to enable this."
            }
            checked={s.showGithubActivity}
            onChange={(v) => set("showGithubActivity", v)}
          />
          <p className="text-sm text-muted">
            {githubToken
              ? "Using GITHUB_TOKEN: data refreshes every 30 minutes."
              : "No GITHUB_TOKEN set: public GitHub limits apply (60 requests an hour). Data is cached for 30 minutes, which is plenty for a personal site."}
          </p>
        </Card>

        <AiCard s={s} set={set} initialKey={aiKey} />

        <Card title="Comments" description="Visitors can comment on articles and blog posts without an account.">
          <div className="divide-y divide-line">
            <div className="pb-4">
              <Switch label="Allow new comments" description="Existing comments stay visible when this is off." checked={s.commentsEnabled} onChange={(v) => set("commentsEnabled", v)} />
            </div>
            <div className="pt-4">
              <Switch label="Approve before publishing" description="New comments wait in Comments → Pending until you approve them." checked={s.commentsRequireApproval} onChange={(v) => set("commentsRequireApproval", v)} />
            </div>
          </div>
          <Field label="Spam protection" htmlFor="captcha">
            <Select
              id="captcha"
              className="field"
              value={s.captchaProvider ?? ""}
              onChange={(v) => set("captchaProvider", (v || null) as Settings["captchaProvider"])}
              options={[
                { value: "", label: `Default (${envCaptcha === "turnstile" ? "Cloudflare Turnstile" : "reCAPTCHA v3"})` },
                { value: "turnstile", label: "Cloudflare Turnstile", hint: captchaKeys.turnstile ? undefined : "Keys missing" },
                { value: "recaptcha", label: "Google reCAPTCHA v3", hint: captchaKeys.recaptcha ? undefined : "Keys missing" },
              ]}
            />
            <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${keysOk ? "text-muted" : "font-medium"}`}>
              <span className={`size-1.5 rounded-full ${keysOk ? "bg-muted" : "bg-fg"}`} aria-hidden="true" />
              {keysOk ? "Keys configured" : "Keys missing — set them in the environment, or visitors can't comment."}
            </p>
          </Field>
        </Card>
      </form>

      <PasswordCard />
      <BackupCard />

      {dirty && (
        <ActionBar label={msg && !msg.ok ? msg.text : "Unsaved changes"}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setS(saved)} disabled={busy}>
            Discard
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </ActionBar>
      )}
      {!dirty && msg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 lg:pl-60">
          <p role="status" className="floating animate-sheet-in px-4 py-2 text-sm">
            {msg.text}
          </p>
        </div>
      )}
    </div>
  );
}

export type AiKeyStatus = { source: "env" | "saved" | null; hint: string | null; unreadable: boolean };

const ANTHROPIC_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"];

function AiCard({ s, set, initialKey }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void; initialKey: AiKeyStatus }) {
  const id = useId();
  const [key, setKey] = useState(initialKey);
  const [draftKey, setDraftKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const anthropic = s.aiProvider === "anthropic";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const saveKey = () =>
    run(async () => {
      setKey(await api<AiKeyStatus>("/api/admin/ai/key", { method: "PUT", json: { key: draftKey } }));
      setDraftKey("");
      setReplacing(false);
      setMsg({ ok: true, text: "API key saved." });
    });

  const removeKey = () =>
    run(async () => {
      if (!confirm("Remove the saved API key?")) return;
      setKey(await api<AiKeyStatus>("/api/admin/ai/key", { method: "DELETE" }));
      setMsg({ ok: true, text: "API key removed." });
    });

  const test = () =>
    run(async () => {
      const r = await api<{ model: string }>("/api/admin/ai/test", { json: { provider: s.aiProvider, model: s.aiModel, baseUrl: s.aiBaseUrl } });
      setMsg({ ok: true, text: `Connected. ${r.model} answered.` });
    });

  return (
    <Card
      title="AI assistant"
      description="Edit posts with AI and let it draft project entries from a GitHub repository. Text you send to it goes to the provider you choose."
    >
      <Switch
        label="Turn on AI features"
        description="Adds an AI button to the editor, summary suggestions, and AI drafting when you create a project from a repository."
        checked={s.aiEnabled}
        onChange={(v) => set("aiEnabled", v)}
      />
      <Field label="Provider" htmlFor={`${id}-provider`}>
        <Select
          id={`${id}-provider`}
          className="field"
          value={s.aiProvider}
          onChange={(v) => {
            const provider = v as Settings["aiProvider"];
            set("aiProvider", provider);
            if (provider === "anthropic" && !ANTHROPIC_MODELS.includes(s.aiModel)) set("aiModel", ANTHROPIC_MODELS[0]!);
            if (provider === "openai" && ANTHROPIC_MODELS.includes(s.aiModel)) set("aiModel", "");
          }}
          options={[
            { value: "anthropic", label: "Anthropic (Claude)" },
            { value: "openai", label: "OpenAI-compatible", hint: "OpenAI, OpenRouter, Ollama, LM Studio…" },
          ]}
        />
      </Field>
      {!anthropic && (
        <Field label="Base URL" htmlFor={`${id}-base`} help="The API root, ending in /v1. Ollama on the same server: http://ollama:11434/v1.">
          <input id={`${id}-base`} type="url" inputMode="url" className="field" placeholder="https://api.openai.com/v1" value={s.aiBaseUrl} onChange={(e) => set("aiBaseUrl", e.target.value)} />
        </Field>
      )}
      <Field
        label="Model"
        htmlFor={`${id}-model`}
        help={anthropic ? "Sonnet is a good default. Opus writes best; Haiku is fastest and cheapest." : "The model name on your endpoint, e.g. llama3.1 or gpt-4o-mini."}
      >
        {anthropic ? (
          <Select
            id={`${id}-model`}
            className="field"
            value={s.aiModel || ANTHROPIC_MODELS[0]!}
            onChange={(v) => set("aiModel", v)}
            options={[
              { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Balanced (default)" },
              { value: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "Best quality" },
              { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "Fastest" },
            ]}
          />
        ) : (
          <input id={`${id}-model`} className="field" value={s.aiModel} onChange={(e) => set("aiModel", e.target.value)} placeholder="Model name" />
        )}
      </Field>
      <Field
        label="API key"
        htmlFor={`${id}-key`}
        help={anthropic ? "From console.anthropic.com → API keys. Stored encrypted and never shown again." : "Leave empty for a local endpoint that needs no key."}
      >
        {key.source === "env" ? (
          <p className="pt-2.5 text-sm text-muted">
            Set by <code>AI_API_KEY</code> in the environment (ends in …{key.hint}).
          </p>
        ) : key.source === "saved" && !replacing ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-muted">Saved key ending in …{key.hint}</span>
            <button type="button" className="btn-quiet" onClick={() => setReplacing(true)} disabled={busy}>
              Replace
            </button>
            <button type="button" className="btn-quiet" onClick={removeKey} disabled={busy}>
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                id={`${id}-key`}
                type="password"
                className="field min-w-0 flex-1"
                autoComplete="off"
                spellCheck={false}
                placeholder={anthropic ? "sk-ant-…" : "sk-…"}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
              />
              <button type="button" className="btn btn-ghost shrink-0" onClick={saveKey} disabled={busy || draftKey.trim().length < 8}>
                Save key
              </button>
            </div>
            {key.unreadable && <p className="mt-1 text-xs font-medium">The saved key can&rsquo;t be read any more (NEXTAUTH_SECRET changed). Enter it again.</p>}
            {replacing && (
              <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => setReplacing(false)}>
                Keep the current key
              </button>
            )}
          </div>
        )}
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Status msg={msg} />
        <button type="button" className="btn btn-ghost" onClick={test} disabled={busy}>
          {busy ? "Working…" : "Test connection"}
        </button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const id = useId();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card title="Account" description="Changing the password signs you out on every device.">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (f.get("newPassword") !== f.get("confirm")) {
            setMsg({ ok: false, text: "Passwords do not match" });
            return;
          }
          try {
            await api("/api/admin/password", { json: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword"), email: f.get("email") || undefined } });
            setMsg({ ok: true, text: "Password changed. Signing out…" });
            setTimeout(() => signOut({ callbackUrl: "/admin/login" }), 1200);
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
          }
        }}
      >
        <Field label="New email" htmlFor={`${id}-email`} help="Optional. Leave empty to keep the current one.">
          <input id={`${id}-email`} name="email" type="email" className="field" autoComplete="username" />
        </Field>
        <Field label="Current password" htmlFor={`${id}-cur`}>
          <input id={`${id}-cur`} name="currentPassword" type="password" className="field" required autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor={`${id}-new`} help="At least 10 characters.">
          <input id={`${id}-new`} name="newPassword" type="password" className="field" required minLength={10} autoComplete="new-password" />
        </Field>
        <Field label="Repeat password" htmlFor={`${id}-rep`}>
          <input id={`${id}-rep`} name="confirm" type="password" className="field" required minLength={10} autoComplete="new-password" />
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Status msg={msg} />
          <button type="submit" className="btn">
            Change password
          </button>
        </div>
      </form>
    </Card>
  );
}

function BackupCard() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Backup" description="A .tar.gz with all posts, articles, comments, pages, settings and images. Your login isn't included.">
      <div className="grid gap-3 sm:grid-cols-2">
        <a className="btn" href="/api/admin/backup" download>
          Download backup
        </a>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            const [file] = await pickFiles(".gz,.tgz,application/gzip", false);
            if (!file) return;
            if (!confirm("Restoring REPLACES all current content with the backup. Continue?")) return;
            setBusy(true);
            setMsg({ ok: true, text: "Restoring…" });
            try {
              const r = await api<{ summary: { posts: number; articles: number; projects: number; comments: number; media: number } }>("/api/admin/backup", {
                body: file,
                headers: { "content-type": "application/gzip" },
              });
              const sum = r.summary;
              setMsg({ ok: true, text: `Restored ${sum.articles} articles, ${sum.posts} posts, ${sum.projects} projects, ${sum.comments} comments, ${sum.media} images.` });
            } catch (err) {
              setMsg({ ok: false, text: (err as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Restoring…" : "Restore from backup…"}
        </button>
      </div>
      <Status msg={msg} />
    </Card>
  );
}
