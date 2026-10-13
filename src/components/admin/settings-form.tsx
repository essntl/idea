"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import type { Settings } from "@/lib/settings";
import { api } from "./api";
import { pickFiles } from "./editor/upload";

const label = "mb-1 block text-sm font-medium";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function SettingsForm({ initial, envCaptcha, captchaKeys }: { initial: Settings; envCaptcha: "turnstile" | "recaptcha"; captchaKeys: { turnstile: boolean; recaptcha: boolean } }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const saved = await api<Settings>("/api/admin/settings", { method: "PUT", json: s });
      setS(saved);
      setMsg({ ok: true, text: "Settings saved" });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={save}>
        <Section title="Site">
          <div>
            <label htmlFor="siteTitle" className={label}>Site title</label>
            <input id="siteTitle" className="field" value={s.siteTitle} onChange={(e) => set("siteTitle", e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label htmlFor="siteDescription" className={label}>Site description</label>
            <textarea id="siteDescription" className="field min-h-20" value={s.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} maxLength={300} />
          </div>
          <div>
            <label htmlFor="authorName" className={label}>Author name</label>
            <input id="authorName" className="field" value={s.authorName} onChange={(e) => set("authorName", e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label htmlFor="postsPerPage" className={label}>Items per page</label>
            <input id="postsPerPage" type="number" min={3} max={100} className="field sm:w-32" value={s.postsPerPage} onChange={(e) => set("postsPerPage", Number(e.target.value))} />
          </div>
        </Section>

        <Section title="Footer links">
          <div>
            <label htmlFor="portfolioUrl" className={label}>Portfolio URL</label>
            <input id="portfolioUrl" type="url" className="field" value={s.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} />
          </div>
          <div>
            <label htmlFor="contactEmail" className={label}>Contact email</label>
            <input id="contactEmail" type="email" className="field" value={s.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </div>
          <div>
            <label htmlFor="githubUrl" className={label}>GitHub URL</label>
            <input id="githubUrl" type="url" className="field" value={s.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} />
          </div>
          <div>
            <span className={label}>Other links</span>
            <ul className="space-y-2">
              {s.socialLinks.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <input className="field w-32" aria-label="Label" value={l.label} onChange={(e) => set("socialLinks", s.socialLinks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="field" aria-label="URL" type="url" value={l.url} onChange={(e) => set("socialLinks", s.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <button type="button" className="btn btn-ghost" onClick={() => set("socialLinks", s.socialLinks.filter((_, j) => j !== i))} aria-label="Remove link">✕</button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost mt-2" onClick={() => set("socialLinks", [...s.socialLinks, { label: "", url: "https://" }])} disabled={s.socialLinks.length >= 10}>
              Add link
            </button>
          </div>
        </Section>

        <Section title="Comments">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-current" checked={s.commentsEnabled} onChange={(e) => set("commentsEnabled", e.target.checked)} />
            Allow new comments
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-current" checked={s.commentsRequireApproval} onChange={(e) => set("commentsRequireApproval", e.target.checked)} />
            Require approval before comments appear
          </label>
          <div>
            <label htmlFor="captcha" className={label}>Captcha provider</label>
            <select id="captcha" className="field sm:w-72" value={s.captchaProvider ?? ""} onChange={(e) => set("captchaProvider", (e.target.value || null) as Settings["captchaProvider"])}>
              <option value="">From environment ({envCaptcha})</option>
              <option value="turnstile">Cloudflare Turnstile{captchaKeys.turnstile ? "" : " (keys missing)"}</option>
              <option value="recaptcha">Google reCAPTCHA v3{captchaKeys.recaptcha ? "" : " (keys missing)"}</option>
            </select>
            <p className="mt-1 text-xs text-muted">Keys are configured with environment variables.</p>
          </div>
        </Section>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-bg py-4">
          <button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
          {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "font-medium"}`}>{msg.text}</p>}
        </div>
      </form>

      <PasswordForm />
      <BackupSection />
    </div>
  );
}

function PasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Section title="Account" description="Changing the password signs you out everywhere.">
      <form
        className="space-y-4"
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
        <div>
          <label htmlFor="email" className={label}>New email (optional)</label>
          <input id="email" name="email" type="email" className="field" autoComplete="username" />
        </div>
        <div>
          <label htmlFor="currentPassword" className={label}>Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" className="field" required autoComplete="current-password" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="newPassword" className={label}>New password</label>
            <input id="newPassword" name="newPassword" type="password" className="field" required minLength={10} autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="confirm" className={label}>Repeat new password</label>
            <input id="confirm" name="confirm" type="password" className="field" required minLength={10} autoComplete="new-password" />
          </div>
        </div>
        <button type="submit" className="btn">Change password</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "font-medium"}`}>{msg.text}</p>}
      </form>
    </Section>
  );
}

function BackupSection() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Backup" description="A backup is a .tar.gz with all content (posts, articles, comments, pages, settings, taxonomy) and every uploaded image. The admin account is not included.">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href="/api/admin/backup" download>Download backup</a>
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
              const s = r.summary;
              setMsg({ ok: true, text: `Restored ${s.articles} articles, ${s.posts} posts, ${s.comments} comments, ${s.media} images.` });
            } catch (err) {
              setMsg({ ok: false, text: (err as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Restoring…" : "Restore from backup"}
        </button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "font-medium"}`}>{msg.text}</p>}
    </Section>
  );
}
