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
- Public page fade uses a CSS animation in `template.tsx`, enabled only after the first client navigation (no delay to the initial paint/LCP); disabled under `prefers-reduced-motion`.

## Content model
- **Tags are shared** between blog posts and articles (one `Tag` table, two many-to-many relations); categories are articles-only.
- Content is stored three ways: TipTap JSON (source of truth for the editor), sanitized+highlighted HTML (what pages render), and plain text (search, reading time).
- Rendering pipeline: TipTap static renderer → `rehype-sanitize` (strict allow-list) → heading ids/TOC → responsive `srcset` → Shiki. Sanitizing happens on every save, so stored HTML is always safe.
- Code highlighting uses two custom **monochrome Shiki themes** (weight/italic/gray only) to respect the black-and-white rule.
- Text colour in the editor is limited to grayscale shades for the same reason.
- Blog post URLs are `/blog/<yyyy-mm-dd>-<title-slug>`; the slug follows the title until the post is first published, then freezes.
- Article slugs are editable, validated live, and must not collide with root routes (`admin`, `blog`, …); renaming a published article's slug adds a 301 from the old URL.
- "Scheduled" = status `scheduled` + a future `publishedAt`; it becomes visible automatically when the time passes. Publishing with a past date backdates.
- Autosave only for drafts; changes to published posts go live only when "Update" is pressed.
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
- `docker-compose.yml` builds locally by default (works before any image is published); set `APP_IMAGE=ghcr.io/essntl/blog-site:latest` to pull the prebuilt one. The compose file builds `DATABASE_URL` from `POSTGRES_*`, so `.env`'s `DATABASE_URL` only matters for local development.
- Image name is `ghcr.io/essntl/blog-site` (from the repository https://github.com/essntl/blog-site); the workflow derives it from `${{ github.repository }}`.
- Backups: a `.tar.gz` with `backup.json` (all content tables, no users) + every media file; restore replaces content in one transaction.
- Site language is `en`; dates are formatted `en-GB` in the `TZ` timezone.
