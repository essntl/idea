# Plan

Milestones are worked through in order. After each one: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## M1 ✅ — Scaffold
- Next.js 16 (App Router) + React 19 + TypeScript (strict), Tailwind CSS v4, ESLint, Vitest.
- Prisma 7 schema covering the full data model, first migration, PostgreSQL 16 dev container (see README → Local development).
- Runtime env validation (Zod) with clear errors.

## M2 ✅ — Core libraries
- Auth.js credentials provider (single admin, argon2), `requireAdmin()` guard, login rate limiting, same-origin (CSRF) check.
- Content pipeline: TipTap JSON → HTML (static renderer) → sanitize → heading ids + TOC → Shiki → stored HTML.
- Media: content-type sniffing, sharp re-encode to WebP, width variants on demand, served from `UPLOAD_DIR` by a route handler.
- Slugs, settings store, DB-backed rate limiter, security headers + CSP (nonce) in `proxy.ts`, legacy redirects.

## M3 ✅ — Public site
- Layout (header, mobile menu, theme toggle, footer), page fade transitions, reduced-motion support.
- Blog list / tag filter / post page; Articles list / category / tag / article page (TOC, prev/next, related).
- About page, search (Postgres full-text), comments (threaded, captcha, honeypot, rate limit, approval setting).
- SEO: metadata, OG/Twitter, canonical, JSON-LD, `sitemap.xml`, `robots.txt`, `rss.xml`.

## M4 ✅ — Admin
- Login, dashboard, shared TipTap editor (slash commands, bubble + top toolbar, images via drop/paste/upload with caption/align/size, autosave, unsaved-changes warning, preview).
- Content lists with filters + bulk actions, comment moderation, media library, categories & tags, About editor, settings (incl. password change, backup export/import).

## M5 ✅ — Markdown import / export
- Front matter parsing, markdown → editor JSON, unresolved local image detection; export any post to `.md`.

## M6 ✅ — Ghost migration
- `npm run migrate:ghost` with `--file export.json` or `--scrape https://artyomtechtips.com`; Ghost cards → editor content, image download, redirects, idempotent, summary report.

## M7 ✅ — Deployment
- Multi-stage Dockerfile (standalone, non-root), entrypoint (env check → migrate → seed → start), `docker-compose.yml`, `docker-compose.zimaos.yml`, GHCR multi-arch workflow, README.

## M8 ✅ — QA
- Tests (auth guard, comments w/ mocked captcha, slug uniqueness, markdown import, migration parser).
- Manual checks at 360 / 390 / 768 / 1280 px, Lighthouse mobile on an article page, fresh `docker compose up -d`.

## Status
All milestones complete. Verified: lint, type-check, 54 unit tests, production build without a database,
fresh `docker compose up -d` from `.env.example`, restart persistence, Ghost scrape of all 19 posts (re-run is a no-op),
Lighthouse mobile on article pages ≥ 98 performance / ≥ 98 accessibility / 100 SEO, no horizontal scroll at 360/390/768/1280 px.
Not verified here: the GitHub Actions run (needs the repo on GitHub), the arm64 image, an import on a real ZimaOS box,
and real (non-test) Turnstile / reCAPTCHA keys.
