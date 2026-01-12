#!/bin/bash
# First-time VPS setup script
# Run this ONCE on a fresh VPS before the first deployment
#
# Usage: ./scripts/first-run-setup.sh
#
# Note: GitHub Actions now handles first-run setup automatically.
# Use this script only for manual setup or debugging.

set -e

echo "=== RxWatch First-Run Setup ==="
echo ""

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found"
  echo ""
  echo "Create .env.local with the following:"
  echo "  DATABASE_URL=postgres://rxwatch:YOUR_PASSWORD@localhost:5433/rxwatch"
  echo "  POSTGRES_USER=rxwatch"
  echo "  POSTGRES_PASSWORD=YOUR_PASSWORD"
  echo "  POSTGRES_DB=rxwatch"
  echo "  DSC_ACCOUNTS='[{\"email\":\"...\",\"password\":\"...\"}]'"
  echo "  CRON_SECRET=your-random-string"
  echo ""
  exit 1
fi

# Load env
set -a
if ! source .env.local; then
  echo "ERROR: Failed to parse .env.local - check for syntax errors"
  exit 1
fi
set +a

# Check required vars
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set in .env.local"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD not set in .env.local"
  exit 1
fi

echo "1. Installing dependencies..."
yarn install --frozen-lockfile

echo ""
echo "2. Creating Docker network..."
docker network inspect web > /dev/null 2>&1 || docker network create web

echo ""
echo "3. Starting database container..."
docker compose -f docker-compose.prod.yml up -d db

# Wait for database
echo "   Waiting for database..."
for i in $(seq 1 12); do
  if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U rxwatch -d rxwatch > /dev/null 2>&1; then
    echo "   Database ready!"
    break
  fi
  if [ $i -eq 12 ]; then
    echo "   ERROR: Database failed to become healthy"
    exit 1
  fi
  sleep 5
done

echo ""
echo "4. Pushing database schema..."
yarn db:push

echo ""
echo "5. Checking for existing data..."
DRUG_COUNT=$(docker compose -f docker-compose.prod.yml exec -T db psql -U rxwatch -d rxwatch -t -c "SELECT COUNT(*) FROM drugs;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$DRUG_COUNT" -gt "1000" ]; then
  echo "   Database already has $DRUG_COUNT drugs - skipping seed"
else
  echo "   Database empty - seeding from cached data..."

  echo ""
  echo "6. Importing DSC shortage history (from history/*.json)..."
  yarn backfill

  echo ""
  echo "7. Importing DPD drug catalog (from dpd/*.json)..."
  yarn sync-dpd:from-cache
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Now start the full stack:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Or let GitHub Actions handle deployment by pushing to main."
echo ""
echo "Set up cron jobs for data sync:"
echo "  crontab -e"
echo "  # Add:"
echo "  0,15,30,45 * * * * cd $(pwd) && yarn sync-dsc >> /var/log/rxwatch-dsc.log 2>&1"
echo "  0 4 * * * cd $(pwd) && yarn sync-dpd >> /var/log/rxwatch-dpd.log 2>&1"
