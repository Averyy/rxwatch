#!/bin/bash
# First-time VPS setup script
# Run this ONCE before starting Docker on a fresh deployment
#
# Usage: ./scripts/first-run-setup.sh

set -e

echo "=== RxWatch First-Run Setup ==="
echo ""

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found"
  echo "Copy .env.example to .env.local and fill in your credentials"
  exit 1
fi

# Load env
export $(grep -v '^#' .env.local | xargs)

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set in .env.local"
  exit 1
fi

echo "1. Starting database container..."
docker compose -f docker-compose.prod.yml up -d db
sleep 5

echo ""
echo "2. Pushing database schema..."
yarn db:push

echo ""
echo "3. Checking for existing data..."
DRUG_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM drugs;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$DRUG_COUNT" -gt "1000" ]; then
  echo "   Database already has $DRUG_COUNT drugs - skipping seed"
else
  echo "   Database empty or minimal - seeding from cached data..."
  echo ""
  echo "4. Importing DSC shortage history (from history/*.json)..."
  yarn backfill

  echo ""
  echo "5. Importing DPD drug catalog (from dpd/*.json)..."
  yarn sync-dpd:from-cache
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Now start the full stack:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Set up cron jobs:"
echo "  crontab -e"
echo "  # Add:"
echo "  0,15,30,45 * * * * cd $(pwd) && yarn sync-dsc >> /var/log/rxwatch-dsc.log 2>&1"
echo "  0 4 * * * cd $(pwd) && yarn sync-dpd >> /var/log/rxwatch-dpd.log 2>&1"
