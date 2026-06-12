#!/bin/sh
set -e

echo "Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "Starting LMS API..."
exec node apps/api/dist/main.js
