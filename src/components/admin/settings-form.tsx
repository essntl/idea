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

const Status = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "font-medium"}`}>
      {msg.text}
    </p>
  ) : null;

export function SettingsForm({ initial, envCaptcha, captchaKeys }: { initial: Settings; envCaptcha: "turnstile" | "recaptcha"; captchaKeys: { turnstile: boolean; recaptcha: boolean } }) {
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
              const r = await api<{ summary: { posts: number; articles: number; comments: number; media: number } }>("/api/admin/backup", {
                body: file,
                headers: { "content-type": "application/gzip" },
              });
              const sum = r.summary;
              setMsg({ ok: true, text: `Restored ${sum.articles} articles, ${sum.posts} posts, ${sum.comments} comments, ${sum.media} images.` });
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
