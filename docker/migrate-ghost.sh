#!/bin/sh
# Ghost migration inside the container, e.g.:
#   docker compose exec app migrate-ghost --scrape
#   docker compose exec app migrate-ghost --file /data/uploads/ghost-export.json
# `docker compose exec` runs as root; downloaded images must belong to the app user.
if [ "$(id -u)" = "0" ]; then
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups node /app/dist/migrate-ghost.mjs "$@"
fi
exec node /app/dist/migrate-ghost.mjs "$@"
