#!/bin/sh
set -e

# The PMS owns the shared schema. Apply any pending migrations before boot.
echo "→ Applying database migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "→ Starting dental-pms..."
exec "$@"
