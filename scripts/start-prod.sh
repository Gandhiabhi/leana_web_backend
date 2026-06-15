#!/bin/sh
set -e

BASELINE_MIGRATION="${PRISMA_BASELINE_MIGRATION:-20250610120000_init}"

echo "Applying database migrations..."
if ! npx prisma migrate deploy 2>/tmp/prisma-migrate.err; then
  if grep -q "P3005" /tmp/prisma-migrate.err; then
    echo "Existing database detected without migration history."
    echo "Baselining migration: ${BASELINE_MIGRATION}"
    npx prisma migrate resolve --applied "${BASELINE_MIGRATION}"
    npx prisma migrate deploy
  else
    cat /tmp/prisma-migrate.err >&2
    exit 1
  fi
fi

echo "Starting API..."
exec node dist/main.js
