#!/bin/bash
# Manual deployment script for RxWatch
# Run this on the VPS to deploy updates manually
#
# Usage: ./scripts/deploy.sh
#
# Note: GitHub Actions handles automatic deployments.
# Use this script only for manual deployments or debugging.

set -e

echo "=== RxWatch Manual Deployment ==="
echo ""

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found"
  echo "Copy .env.example to .env.local and fill in your credentials"
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

echo "1. Pulling latest changes..."
git pull

echo ""
echo "2. Installing dependencies..."
yarn install --frozen-lockfile

echo ""
echo "3. Ensuring Docker network exists..."
docker network inspect web > /dev/null 2>&1 || docker network create web

echo ""
echo "4. Starting database..."
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
echo "5. Applying database schema changes..."
yarn db:push

echo ""
echo "6. Pulling latest Docker image..."
docker compose -f docker-compose.prod.yml pull app

echo ""
echo "7. Restarting app container..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "8. Verifying deployment..."
sleep 5

HEALTH_OK=false
for i in $(seq 1 12); do
  if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "   App is healthy!"
    HEALTH_OK=true
    break
  fi
  echo "   Waiting... ($i/12)"
  sleep 5
done

if [ "$HEALTH_OK" = false ]; then
  echo ""
  echo "   ERROR: Health check failed after 60 seconds"
  echo ""
  docker compose -f docker-compose.prod.yml logs --tail=30 app
  exit 1
fi

echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Check logs: docker logs -f rxwatch-app"
