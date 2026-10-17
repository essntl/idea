# Decisions

One line each; where the brief was silent or a choice had to be made.

## Stack & versions
- Next.js 16.4 (App Router) + React 19.3; TypeScript **6.0** — TypeScript 7 (native) ships no JS API, which Next.js needs for type-checking.
- Prisma **7.10** (latest stable; npm's `latest` tag points at an 8.0 RC). Uses the new `prisma-client` generator + `@prisma/adapter-pg`.
- Auth: **next-auth v4.24** (stable "NextAuth.js"); Auth.js v5 is still in beta. JWT sessions, credentials provider.
- Password hashing: **argon2id** via `@node-rs/argon2` (prebuilt binaries for amd64/arm64, no build tools).
- ESLint 9 (what `eslint-config-next` 16 supports) with the flat config.
- Tailwind CSS v4, no typography plugin — prose styles are hand-written in `globals.css` for full control of the black/white look.
- Fonts: Inter (variable, Latin + Cyrillic subsets) self-hosted via `next/font/local` with `display: swap`; system monospace stack for code.

## Rendering & caching
- Every page renders on demand (the root layout reads the CSP nonce), so `next build` never needs a database; data is cached with `unstable_cache` (tags `content`, `comments`, `settings`, `redirects`) and invalidated immediately on publish/edit — this is the "revalidation on publish".
- Cached reads also revalidate every 60 s so scheduled articles go live without a manual action.
- Page transitions are a ~200 ms cross-fade via React `<ViewTransition>` (View Transitions API) around page content in the site and admin layouts; header and sidebar stay still. Browsers without the API just swap pages; `prefers-reduced-motion` disables it.
- Visual style (revised): rounded corners from radius tokens (6/10/14/18 px), soft surfaces instead of hard boxes, and a subtle shadow on floating UI only (menus, toolbars, dialogs). Still strictly black, white and grays.

## Content model
- **Tags are shared** between blog posts and articles (one `Tag` table, two many-to-many relations); categories are articles-only.
- Content is stored three ways: TipTap JSON (source of truth for the editor), sanitized+highlighted HTML (what pages render), and plain text (search, reading time).
- Rendering pipeline: TipTap static renderer → `rehype-sanitize` (strict allow-list) → heading ids/TOC → responsive `srcset` → Shiki. Sanitizing happens on every save, so stored HTML is always safe.
- Code highlighting uses two custom **monochrome Shiki themes** (weight/italic/gray only) to respect the black-and-white rule.
- Text colour in the editor is limited to grayscale shades for the same reason.
- Blog post URLs are `/blog/<yyyy-mm-dd>-<title-slug>`; the slug follows the title until the post is first published, then freezes.
- Article slugs are editable, validated live, and must not collide with root routes (`admin`, `blog`, …); renaming a published article's slug adds a 301 from the old URL.
- "Scheduled" = status `scheduled` + a future `publishedAt`; it becomes visible automatically when the time passes. Publishing with a past date backdates.
- Autosave is on for everything (about 1 s after you stop typing). See "Drafts and pending changes" under Revisions.
- Added fields beyond the brief: `contentText` (search), `toc`, `User.sessionVersion` (password change signs out other sessions), `User.lastSeenCommentsAt` (dashboard "new" count), `Media.sourceUrl` (import de-duplication), `RateLimit` table.

## Media
- All uploads are validated by decoding with `sharp` (content, not extension), EXIF-rotated, stripped of metadata, capped at 2400 px and **re-encoded to WebP**; SVG is rejected. Animated GIF/WebP stay animated.
- Images are served by a route handler from `UPLOAD_DIR` (`/media/...`) with `?w=` width variants generated on demand and cached on disk; `next/image` uses a custom loader mapped to those widths (no self-fetching optimizer).
- Cropping the article preview image creates a new cropped copy (original untouched).
- Deleting an image that is still used asks for confirmation (usage is detected in preview images and stored HTML).

## Comments & security
- Captcha provider: env `CAPTCHA_PROVIDER` is the default; Admin → Settings can override it. Keys always come from env.
- `.env.example` ships with **Cloudflare's public Turnstile test keys** so a fresh install works immediately (and server-side verification still runs); the app logs a warning while they're in use.
- Rate limits are stored in Postgres (fixed windows): comments 5 per 10 min per IP hash; login 10 per 15 min per IP hash; password change 5 per 15 min.
- IPs are stored only as a salted SHA-256 hash (salt = `NEXTAUTH_SECRET`).
- Comment status set: `visible | pending | hidden | deleted` (added `pending` for the approval setting). Hidden and deleted comments both render as "Comment removed" when they have visible replies, and disappear otherwise.
- Replies are unlimited in depth in the database; the UI indents up to 3 levels and keeps deeper replies at level 3.
- Comment text is plain text (React-escaped), never HTML; at most 2 links, 5000 chars.
- CSRF: Auth.js protects its own endpoints with its CSRF token; all other state-changing admin/public API routes require a same-origin `Origin`/`Referer`.
- CSP with a per-request nonce + `strict-dynamic` is set in `proxy.ts`; `style-src 'unsafe-inline'` is allowed (Shiki/TipTap inline styles).
- The admin gate is enforced twice: `proxy.ts` (cookie present) and every page/route (session verified against the DB).

## Migration
- Ghost tags: **first tag → category, the rest → tags** (`--tags all-tags` keeps them all as tags).
- Scrape mode finds no tags on artyomtechtips.com (the theme doesn't expose them), so scraped articles have no category; the export JSON includes tags.
- Only images hosted on the Ghost site (`/content/images/…`) are downloaded by default (original size, `/size/w…/` stripped). Hot-linked third-party images stay remote unless `--download-external` is passed.
- Images on unreachable hosts (e.g. `*.local` left over from an old WordPress install) are imported as "missing": hidden on the public page, flagged in the editor with an upload button.
- Ghost's `?ref=<site>` tracking parameter is removed from outbound links. Button cards become links, bookmark cards become link cards, YouTube embeds become video embeds.
- Legacy URLs (`/slug` and `/slug/`) redirect with **301** in one hop via a `Redirect` table checked in `proxy.ts` (cached 60 s).

## Deployment
- Runtime image: `node:22-bookworm-slim` (glibc — avoids musl issues with sharp/argon2/Prisma), `tini` as PID 1.
- The entrypoint starts as root only to `chown` the uploads folder (ZimaOS bind mounts are created root-owned), then re-executes itself as UID 1001 via `setpriv`; migrations, seed and the server all run unprivileged.
- Migrations run with a standalone Prisma CLI installed in `/opt/prisma`; seed and migration scripts are esbuild bundles in `/app/dist`.
- `docker-compose.yml` builds locally by default (works before any image is published); set `APP_IMAGE=ghcr.io/essntl/idea:latest` to pull the prebuilt one. The compose file builds `DATABASE_URL` from `POSTGRES_*`, so `.env`'s `DATABASE_URL` only matters for local development.
- Image name is `ghcr.io/essntl/idea` (from the repository https://github.com/essntl/idea); the workflow derives it from `${{ github.repository }}`.
- Backups: a `.tar.gz` with `backup.json` (all content tables, no users) + every media file; restore replaces content in one transaction.
- Site language is `en`; dates are formatted `en-GB` in the `TZ` timezone.

## Revisions after first release
- **Blog posts have comments too** (the original brief said articles only). `Comment` has nullable `articleId` and `blogPostId` with a CHECK constraint requiring exactly one; the API takes `targetType` (`article` | `blog`) + `targetId`. Same captcha, honeypot, rate limit and approval rules for both.
- **Dropdowns** use a custom `Select` (src/components/ui/select.tsx) instead of native `<select>`, because the open list of a native select can't be styled. It renders its list in a portal (never clipped by scrolling toolbars), supports full keyboard use and type-ahead, and can post its value through a hidden input in plain GET forms.
- **Image lightbox**: clicking an image in a blog post or article (and the article cover) opens the 2000 px variant full-screen; click toggles actual size, ←/→ moves between images, Esc closes. Nothing loads until an image is clicked.
- **Preview shows unsaved changes.** The editor hands its current state to the preview tab via `localStorage` + `BroadcastChannel` (same browser only); the preview renders it through the normal sanitizing pipeline (`POST /api/admin/preview`, nothing stored) and keeps updating while you edit. Opening `/admin/preview/...` directly shows the saved version.
- **Drafts and pending changes.** Never-published posts autosave in place and stay invisible until published. Live content (published or scheduled posts, the About page) autosaves into a separate `draft` JSON column (+ `draftUpdatedAt`) via `PUT /api/admin/drafts/[kind]/[id]`; public pages keep reading the published columns. "Publish changes" runs the normal save (validation, rendering, redirects) and clears the draft; "Discard changes" deletes it. Drafts are validated loosely (half-written titles/slugs are fine) and never carry a status, so publishing is always an explicit action. The dashboard lists drafts and pending changes under "Continue writing"; lists mark pending changes with an "edits" pill.
- Page transitions are keyed to the URL (`PageTransition`), so navigation cross-fades but `router.refresh()` after a save doesn't.
- **Projects** (`/projects`, `Project` table) reuse the post editor (autosave, pending changes, preview). `status` is visibility (draft/published); `phase` (planning, building, live, paused, archived) is where the project stands. Blog posts and articles can point at a project (`projectId`, nullable, `ON DELETE SET NULL`) and then show up on it as progress updates. Links are stored normalised (`github.com/x` → `https://github.com/x`) but only validated on publish, so half-typed links still autosave.
- **GitHub data needs no token.** Profile, repositories, events and per-repo stats use the public REST API (60 requests/hour unauthenticated); the contribution calendar comes from GraphQL when `GITHUB_TOKEN` is set, otherwise from the public `github.com/users/<name>/contributions` fragment. Results are cached with `unstable_cache` (profile 30 min, repos 1 h); after a failure or rate limit GitHub isn't called again for 5 minutes, and every widget renders inside `<Suspense>` and disappears instead of breaking the page. Push events no longer carry commit messages, so the profile widget shows recently pushed repositories and the project page reads commits from the repository's commits API.
- Stored redirects are now checked for every public path except `/admin`, `/api`, `/media` and `/_next`. Previously `/articles/*` was skipped, so redirects created by renaming an article's slug were never served.
- **AI assistant** talks to Anthropic's Messages API or any OpenAI-compatible endpoint with plain `fetch` (no SDK; requests are small and non-streaming). Structured output (project drafts) uses a forced tool call on Anthropic and a JSON-in-prompt fallback elsewhere, validated with Zod either way. The API key lives in the `Setting` table under `secret:aiApiKey`, AES-256-GCM encrypted with a key derived from `NEXTAUTH_SECRET`; `secret:*` rows are never returned by the settings API, never exported in backups, and survive restores. AI edits are previewed and applied as one editor transaction, so they're undoable and never saved without the normal autosave/publish flow.
- **Projects from a repository** read the GitHub API (metadata, languages, README, root files, workflows) plus a few manifests from raw.githubusercontent.com. A package link is only filled in when the registry entry points back to the repository (a package name alone isn't proof). If the AI step fails, the draft is still created from repository data, with a note.
- **AI edits stream in place.** `/api/admin/ai/edit` relays the provider's server-sent events as newline-delimited JSON (text chunks, then the final content parsed from markdown on the server). In the editor a ProseMirror plugin hides the original range with decorations and shows a widget with a word-level diff (`diff`'s `diffWordsWithSpace`) that's redrawn at most once per frame; the document itself isn't modified (and the editor is read-only) until Accept, which applies the server-parsed content as one undoable transaction.
