#!/bin/sh
set -e

echo "Starting RxWatch..."

echo "Waiting for database..."
sleep 3

echo "Checking database connection..."
until psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database connected!"

echo "Verifying tables exist..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('drugs', 'reports');")
TABLE_COUNT=$(echo $TABLE_COUNT | tr -d ' ')

if [ "$TABLE_COUNT" -lt 2 ]; then
  echo ""
  echo "ERROR: Database tables not found (found $TABLE_COUNT/2)."
  echo ""
  echo "Run first-time setup on VPS before starting Docker:"
  echo "  ./scripts/first-run-setup.sh"
  echo ""
  exit 1
fi

echo "Tables verified! Checking for data..."
DRUG_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM drugs;")
DRUG_COUNT=$(echo $DRUG_COUNT | tr -d ' ')

if [ "$DRUG_COUNT" -lt 1000 ]; then
  echo ""
  echo "WARNING: Database appears empty ($DRUG_COUNT drugs)."
  echo "Run first-time setup to seed data:"
  echo "  ./scripts/first-run-setup.sh"
  echo ""
  echo "Starting anyway..."
fi

echo "Starting Next.js server on port ${PORT:-5000}..."
exec node server.js
