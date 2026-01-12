#!/bin/bash
# Deployment script for RxWatch
# Run this to deploy updates to VPS
#
# Usage: ./scripts/deploy.sh
#
# This script:
# 1. Pulls latest changes
# 2. Applies database schema changes
# 3. Pulls/builds Docker image
# 4. Restarts the app container

set -e

echo "=== RxWatch Deployment ==="
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

echo "1. Pulling latest changes..."
git pull

echo ""
echo "2. Installing dependencies..."
yarn install --frozen-lockfile

echo ""
echo "3. Applying database schema changes..."
yarn db:push

echo ""
echo "4. Pulling latest Docker image..."
docker compose -f docker-compose.prod.yml pull app

echo ""
echo "5. Restarting app container..."
docker compose -f docker-compose.prod.yml up -d app

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Check logs: docker logs -f rxwatch-app"
