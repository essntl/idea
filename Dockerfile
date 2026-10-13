# syntax=docker/dockerfile:1.7
# Multi-stage build → small, non-root production image (Next.js standalone output).

ARG NODE_VERSION=22

# ---------- base ----------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---------- dependencies ----------
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No database is needed at build time (all pages render on demand).
RUN npm run build && npm run build:scripts

# ---------- runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG VERSION=dev
LABEL org.opencontainers.image.title="artem-blog" \
      org.opencontainers.image.description="Personal blog + articles (Next.js, PostgreSQL)" \
      org.opencontainers.image.source="https://github.com/essntl/blog-site" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads \
    TZ=UTC

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home /app nextjs \
  && mkdir -p /data/uploads \
  && chown -R nextjs:nodejs /data

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build /app/prisma/migrations ./prisma/migrations
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
COPY docker/migrate-ghost.sh /usr/local/bin/migrate-ghost
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint /usr/local/bin/migrate-ghost \
  && chmod 755 /usr/local/bin/entrypoint /usr/local/bin/migrate-ghost

# The entrypoint starts as root only to fix ownership of bind-mounted /data/uploads,
# then re-executes itself as the unprivileged "nextjs" user (UID 1001).
EXPOSE 3000
VOLUME ["/data/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint"]
