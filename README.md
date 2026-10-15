# idea

**idea** (ιδέα) — a minimal, black-and-white personal site:

- **Blog** (`/blog`): a diary-style list of short posts, with comments.
- **Articles** (`/articles`): long-form writing with categories, custom slugs, preview images, a table of contents and threaded comments.
- **About** (`/about`): a single page you edit from the admin.
- **Admin** (`/admin`): a Notion-like editor (slash commands, selection toolbar, drag & drop images, markdown import/export), comment moderation, media library, categories & tags, settings, and backups.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL 16, Prisma 7, Auth.js, TipTap and Shiki. It ships as a single Docker image.

---

## Contents

1. [Quick start (Docker)](#quick-start-docker)
2. [ZimaOS](#zimaos)
3. [HTTPS: reverse proxy or Cloudflare Tunnel](#https-reverse-proxy-or-cloudflare-tunnel)
4. [Captcha keys](#captcha-keys)
5. [Projects and GitHub activity](#projects-and-github-activity)
6. [Migrating from Ghost](#migrating-from-ghost)
7. [Backup, restore and updates](#backup-restore-and-updates)
8. [Local development](#local-development)
9. [Configuration reference](#configuration-reference)
10. [Icon and branding](#icon-and-branding)
11. [Project layout](#project-layout)

---

## Quick start (Docker)

You need Docker with the Compose plugin.

```bash
git clone https://github.com/essntl/idea.git && cd idea
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | What to put |
|---|---|
| `NEXTAUTH_SECRET` | A random secret, e.g. the output of `openssl rand -base64 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The admin login (the account is created on the first start) |
| `POSTGRES_PASSWORD` | A database password (avoid `@ : / ? #`) |
| `SITE_URL` | The public address, e.g. `https://blog.example.com` (keep `http://localhost:3000` for a local try) |

Then start everything:

```bash
docker compose up -d
```

The first run builds the image, which takes a few minutes. Open <http://localhost:3000> for the site and <http://localhost:3000/admin> to sign in.

On start, the container checks the configuration, applies database migrations, creates the admin account if it doesn't exist yet, and starts the server. If `NEXTAUTH_SECRET` or the admin credentials are missing (or still `CHANGE_ME`), it stops and prints what to fix. To see that output, run `docker compose logs -f app`.

**Use the prebuilt image instead of building.** Set `APP_IMAGE=ghcr.io/essntl/idea:latest` in `.env`, then run:

```bash
docker compose pull
```

```bash
docker compose up -d
```

Data is kept in two named volumes: `db-data` (PostgreSQL) and `uploads` (images).

---

## ZimaOS

`docker-compose.zimaos.yml` uses the prebuilt image from GHCR and stores data under `/DATA/AppData/idea/`.

1. **Import the app.** In ZimaOS, open the **App Store**, click **+** (top right), choose **Install a customized app**, then **Import**. Paste the contents of `docker-compose.zimaos.yml` or upload the file, and confirm.
2. **Fill in the settings.** In the app settings form, replace every `CHANGE_ME`:
   - `NEXTAUTH_SECRET`: 32 or more random characters. Run `openssl rand -base64 32` on any computer, or use a password generator.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: your login.
   - `SITE_URL`: how you'll reach the site, e.g. `http://192.168.1.50:3000`, or your HTTPS domain if it sits behind a proxy or tunnel.
   - **The database password appears twice and both must match:** `POSTGRES_PASSWORD` on the `db` service, and `CHANGE_ME_DB_PASSWORD` inside `DATABASE_URL` on the `app` service.
   - Optional: real captcha keys (see [Captcha keys](#captcha-keys)).
   - Change the published web port (default `3000`) if it's already taken.
3. **Install and wait.** Click **Install**. The first start pulls the images and runs migrations, which takes about a minute.
4. **Sign in.** Open the app from the dashboard, go to `/admin`, and sign in with the admin email and password. Then change the password in **Admin → Settings → Account**.

**Where the data lives:**

| Path on ZimaOS | Contents |
|---|---|
| `/DATA/AppData/idea/postgres` | Database files |
| `/DATA/AppData/idea/uploads` | Images |

Both survive restarts, updates and reinstalls. To update, use **Check for updates** / **Update** on the app (it pulls `ghcr.io/essntl/idea:latest`) and restart; migrations run automatically.

> If your fork has a different repository name, change `image:` (and `icon:`) in the file to `ghcr.io/<owner>/<repo>`.

> **`getaddrinfo ENOTFOUND idea-db` in the app log** means the two containers aren't on the same network. In the app settings, set **Network type** to `idea` for both the `app` and `db` services (not `bridge`: Docker's default bridge network can't resolve container names), save, and restart.
>
> Keep `: @ / ? #` out of the database password, or percent-encode them inside `DATABASE_URL` (e.g. `:` → `%3A`).

---

## HTTPS: reverse proxy or Cloudflare Tunnel

The app listens on plain HTTP on port 3000. Put TLS in front of it, and set `SITE_URL` (and optionally `NEXTAUTH_URL`) to the public `https://…` address. That address is used for canonical URLs, RSS, Open Graph, and for secure login cookies.

**Caddy:**

```caddyfile
blog.example.com {
    reverse_proxy localhost:3000
}
```

**Nginx:**

```nginx
server {
    server_name blog.example.com;
    listen 443 ssl http2;
    # ssl_certificate … / ssl_certificate_key …
    client_max_body_size 50m;          # image uploads and backup restores
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The proxy must pass the original `Host` (or `X-Forwarded-Host`). Admin and comment requests check that the browser's `Origin` matches it.

**Cloudflare Tunnel** (no open ports, works well on ZimaOS):

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel**, choose *Cloudflared*, and copy the token.
2. Run the connector next to the app, either as a ZimaOS app or with compose:

   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token <TOKEN>
   ```

3. In the tunnel's **Public Hostname** tab, add `blog.example.com` → `http://<server-ip>:3000`. If cloudflared runs in the same compose project, you can use `http://app:3000` instead.
4. Set `SITE_URL=https://blog.example.com` and restart the app.

Visitor IPs, used for rate limiting, are read from `CF-Connecting-IP`, `X-Forwarded-For` or `X-Real-IP`. Raw IPs are never stored, only a salted hash.

---

## Captcha keys

Every comment and reply is verified server-side. Choose a provider with `CAPTCHA_PROVIDER`; you can also switch providers in **Admin → Settings** once both key pairs are set.

- **Cloudflare Turnstile (default):** in the Cloudflare dashboard, go to **Turnstile → Add widget**, enter your domain (add `localhost` for testing), and pick the *Managed* mode. Copy the keys into `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
  `.env.example` contains Cloudflare's public *test* keys, which let everyone pass. They're fine for trying the site out but must be replaced before going live (the app logs a warning while they're in use).
- **Google reCAPTCHA v3:** go to <https://www.google.com/recaptcha/admin/create>, choose **Score based (v3)**, and add your domain. Set `CAPTCHA_PROVIDER=recaptcha`, `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`. Comments with a score below 0.5 are rejected.

---

## Projects and GitHub activity

**Admin → Projects** manages the `/projects` page. Each project has a status (Building, Live, Planning, Paused, Archived), a summary, an optional write-up and cover image, a tech stack, and up to three links: repository, website and package (npm, GHCR, PyPI, Docker Hub, app stores…). Featured projects are listed first and appear on the home page.

- **Progress updates:** in a blog post's or article's settings, pick a **Project**. The post is then listed on the project page as a progress update, and the post links back to the project.
- **Repository stats:** for GitHub repositories, project cards show stars, language and the last push; the project page also shows forks, open issues, the latest release and recent commits.
- **GitHub activity:** the top of `/projects` shows your GitHub profile picture, public repositories, stars, followers, contributions, current and longest streak, a contribution graph, languages and recently pushed repositories. The account comes from the GitHub link in **Admin → Settings**; the widget can be turned off there.

GitHub data is cached (profile 30 minutes, repositories 1 hour) and never blocks a page: if GitHub is slow or unreachable, the widgets are simply left out. No token is needed for a personal site. Set `GITHUB_TOKEN` (a fine-grained, read-only token with no extra permissions) to raise GitHub's limit from 60 to 5,000 requests an hour.

---

## Migrating from Ghost

The importer brings every **published post** from the Ghost site into **Articles**:

- It keeps the original slug and publish date.
- It converts Ghost cards (images, galleries, callouts, code, bookmarks, embeds, buttons, toggles) into editor content.
- It downloads the feature image and all images from `/content/images/…` at original size into the media library.
- It maps the first tag to a category and the rest to tags.
- It creates a 301 redirect from the old URL (`/slug/`) to `/articles/slug`.

It's safe to run repeatedly: posts are matched by slug, images by source URL. Each run prints a report (imported, skipped, failed, images downloaded).

**Option 1: Ghost export (preferred).** In Ghost Admin, go to **Settings → Advanced → Import/Export → Export your content** to download a `.json` file. Copy it into the uploads volume and run the importer inside the container:

```bash
docker compose cp ghost-export.json app:/data/uploads/ghost-export.json
```

```bash
docker compose exec app migrate-ghost --file /data/uploads/ghost-export.json
```

**Option 2: scrape the live site.** This reads `/sitemap-posts.xml` (falling back to `/rss/`) and each post page:

```bash
docker compose exec app migrate-ghost --scrape https://artyomtechtips.com
```

On ZimaOS, open the app's terminal from the dashboard (or `docker exec -it idea sh`) and run `migrate-ghost --scrape https://artyomtechtips.com`.

**Options:**

| Flag | Effect |
|---|---|
| `--dry-run` | Parse and report without writing anything |
| `--limit 3` | Only process the first three posts |
| `--update` | Re-import posts that already exist (overwrites them) |
| `--tags all-tags` | Keep all Ghost tags as tags (no category) |
| `--download-external` | Also download hot-linked images from other websites |
| `--site-url <url>` | Old site address used to resolve relative links (export mode) |

**Running locally (outside Docker):**

```bash
npm run migrate:ghost -- --scrape https://artyomtechtips.com
```

Images that can't be downloaded are listed in the report. In the editor they show a **Missing image** placeholder with an upload button; on the public page they're hidden.

New articles appear on the public site within a minute (cached pages refresh every 60 s).

---

## Backup, restore and updates

**From the admin.** **Settings → Backup → Download backup** produces a `.tar.gz` with all content (posts, articles, comments, pages, settings, categories, tags, redirects) plus every image. **Restore from backup** replaces all content with an archive's contents. The admin account isn't included.

**From the command line (Docker).**

Database dump:

```bash
docker compose exec -T db pg_dump -U blog -d blog --clean --if-exists > blog-$(date +%F).sql
```

Images:

```bash
docker run --rm -v idea_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Restore (stop the app first so nothing writes during the restore):

```bash
docker compose stop app
```

```bash
docker compose exec -T db psql -U blog -d blog < blog-2026-01-01.sql
```

```bash
docker run --rm -v idea_uploads:/data -v "$PWD":/backup alpine sh -c "cd /data && tar xzf /backup/uploads-2026-01-01.tar.gz"
```

```bash
docker compose start app
```

On ZimaOS, back up the folder `/DATA/AppData/idea/`. The database files are only consistent while the app is stopped, so prefer `pg_dump` via `docker exec idea-db pg_dump -U blog blog > dump.sql`.

**Updating.**

With a locally built image:

```bash
git pull && docker compose up -d --build
```

With the prebuilt image:

```bash
docker compose pull && docker compose up -d
```

Migrations run automatically on start. Take a backup before major version updates.

---

## Local development

Requirements: Node.js 22 or newer, and Docker (or any PostgreSQL 16).

1. Start a database:

   ```bash
   docker run -d --name blog-dev-db -e POSTGRES_USER=blog -e POSTGRES_PASSWORD=blog -e POSTGRES_DB=blog -p 5432:5432 postgres:16-alpine
   ```

2. Install dependencies and configure. In `.env`, set `DATABASE_URL=postgresql://blog:blog@localhost:5432/blog`, `NEXTAUTH_SECRET` and the admin credentials.

   ```bash
   npm install
   ```

   ```bash
   cp .env.example .env
   ```

3. Create the tables and the admin account:

   ```bash
   npx prisma migrate deploy && npm run db:seed
   ```

4. Run the app at <http://localhost:3000>:

   ```bash
   npm run dev
   ```

| Script | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + `tsc` |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Create the admin account and About page if missing |
| `npm run migrate:ghost` | Ghost importer (see above) |

---

## Configuration reference

All settings are environment variables, documented in [`.env.example`](.env.example).

| Variable | Default | Notes |
|---|---|---|
| `SITE_URL` | `http://localhost:3000` | Public URL (no trailing slash) |
| `NEXTAUTH_URL` | `SITE_URL` | Auth callback base URL |
| `NEXTAUTH_SECRET` | *required* | 32+ random characters |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | *required* | Used to create the admin on first start |
| `DATABASE_URL` | built by compose | PostgreSQL connection string |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `blog` | Bundled database |
| `CAPTCHA_PROVIDER` | `turnstile` | `turnstile` or `recaptcha` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | test keys | Cloudflare Turnstile |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | — | Google reCAPTCHA v3 |
| `GITHUB_TOKEN` | — | Optional; higher GitHub API limit for the projects page |
| `UPLOAD_DIR` | `/data/uploads` in Docker | Image storage |
| `MAX_UPLOAD_MB` | `15` | Per image |
| `TZ` | `UTC` | Timezone for displayed dates |
| `APP_PORT` | `3000` | Host port (compose) |
| `APP_IMAGE` | local build | e.g. `ghcr.io/essntl/idea:latest` |

The site title, description, footer links, GitHub activity, comment approval and comment on/off switches are edited in **Admin → Settings**. The footer defaults to artemk.dev, contact@artemk.dev and github.com/essntl.

---

## Icon and branding

The icon (an italic *i* followed by a text cursor) lives in [`branding/icon.svg`](branding/icon.svg); every other size is generated from it with `node scripts/make-icons.mjs`:

| File | Used for |
|---|---|
| `src/app/favicon.ico` (16/32/48), `src/app/icon.svg`, `src/app/apple-icon.png` | Browser tab, bookmarks, iOS home screen |
| `public/icon-256.png` | ZimaOS / CasaOS app icon (`x-casaos.icon` in `docker-compose.zimaos.yml`) |
| `branding/icon-512.png`, `branding/icon-1024.png` | GitHub / Docker Hub avatar (rounded tile) |
| `branding/avatar-1024.png` | Same, full-bleed square for services that crop to a circle |
| `branding/social-preview.png` (1280×640) | GitHub → repository **Settings → Social preview** |
| `branding/icon-mark.svg` | The mark alone, `currentColor`, for use on any background |

GitHub doesn't support per-repository avatars and GHCR has no image icon, so upload `avatar-1024.png` as your GitHub (or Docker Hub) profile picture if you want it there, and `social-preview.png` as the repository's link preview.

---

## Project layout

```
branding/              icon sources and exports (see Icon and branding)
src/app/(site)/        public pages (blog, articles, projects, about, search)
src/app/admin/         admin pages (panel, login, preview)
src/app/api/           route handlers (comments, admin API, auth, health)
src/app/media/         image serving with on-demand width variants
src/components/        site + admin components (editor in components/admin/editor)
src/lib/               data access, auth, content pipeline, markdown, Ghost parser
src/proxy.ts           CSP nonce, admin gate, legacy redirects
prisma/                schema, migrations, seed
scripts/               Ghost migration, script bundler, env check
docker/                entrypoint and container helpers
tests/                 Vitest unit tests
```

See [PLAN.md](PLAN.md) for the build plan and [DECISIONS.md](DECISIONS.md) for design decisions.
