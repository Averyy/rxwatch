#!/bin/sh
set -e

echo "Starting RxWatch..."

# Wait for database with timeout (max 60 seconds)
# Use PGCONNECT_TIMEOUT for connection timeout
echo "Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Use PGCONNECT_TIMEOUT to prevent hanging connections
  if PGCONNECT_TIMEOUT=5 psql "${DATABASE_URL}" -c "SELECT 1" > /dev/null 2>&1; then
    echo "Database connected!"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Database connection failed after ${MAX_RETRIES} attempts"
    exit 1
  fi

  echo "Database not ready, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "Verifying tables exist..."
TABLE_COUNT=$(PGCONNECT_TIMEOUT=5 psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('drugs', 'reports');" 2>/dev/null || echo "0")
TABLE_COUNT=$(echo "$TABLE_COUNT" | xargs)

if [ "$TABLE_COUNT" -lt 2 ]; then
  echo ""
  echo "WARNING: Database tables not found (found $TABLE_COUNT/2)."
  echo ""
  echo "This may be a first-run scenario where schema is being set up."
  echo "Waiting for schema to be initialized..."
  echo ""

  # Wait up to 2 minutes for schema to appear (first deployment)
  SCHEMA_RETRIES=24
  SCHEMA_COUNT=0
  while [ $SCHEMA_COUNT -lt $SCHEMA_RETRIES ]; do
    TABLE_COUNT=$(PGCONNECT_TIMEOUT=5 psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('drugs', 'reports');" 2>/dev/null || echo "0")
    TABLE_COUNT=$(echo "$TABLE_COUNT" | xargs)

    if [ "$TABLE_COUNT" -ge 2 ]; then
      echo "Schema initialized!"
      break
    fi

    SCHEMA_COUNT=$((SCHEMA_COUNT + 1))
    if [ $SCHEMA_COUNT -eq $SCHEMA_RETRIES ]; then
      echo "ERROR: Schema not initialized after 2 minutes."
      echo "GitHub Actions should handle schema setup automatically."
      exit 1
    fi

    echo "Waiting for schema... ($SCHEMA_COUNT/$SCHEMA_RETRIES)"
    sleep 5
  done
fi

echo "Tables verified! Checking for data..."
DRUG_COUNT=$(PGCONNECT_TIMEOUT=5 psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM drugs;" 2>/dev/null || echo "0")
DRUG_COUNT=$(echo "$DRUG_COUNT" | xargs)

if [ "$DRUG_COUNT" -lt 1000 ]; then
  echo ""
  echo "WARNING: Database appears empty ($DRUG_COUNT drugs)."
  echo "Data seeding may still be in progress or failed."
  echo ""
  echo "Starting anyway..."
fi

echo "Starting Next.js server on port ${PORT:-5000}..."
exec node server.js
