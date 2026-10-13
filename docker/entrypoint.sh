#!/bin/sh
# Container start: validate configuration -> apply migrations -> seed admin (first boot only) -> start Next.js.
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"

# Started as root: make sure the (possibly bind-mounted) upload folder is writable, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOAD_DIR"
  chown -R nextjs:nodejs "$UPLOAD_DIR" 2>/dev/null || echo "warning: could not chown $UPLOAD_DIR" >&2
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$0" "$@"
fi

export SITE_URL="${SITE_URL:-${NEXTAUTH_URL:-http://localhost:3000}}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-$SITE_URL}"

node /app/dist/check-env.mjs

echo "-> Applying database migrations"
attempt=1
until node /app/dist/migrate-db.mjs /app/prisma/migrations; do
  if [ "$attempt" -ge 10 ]; then
    echo "x Could not apply migrations after $attempt attempts. Is the database reachable? (DATABASE_URL must point at the db service)" >&2
    exit 1
  fi
  echo "   database not ready yet, retrying in 3s ($attempt/10)"
  attempt=$((attempt + 1))
  sleep 3
done

echo "-> Seeding (creates the admin account on first start)"
node /app/dist/seed.mjs

echo "-> Starting on port ${PORT:-3000} (${SITE_URL})"
exec node /app/server.js
