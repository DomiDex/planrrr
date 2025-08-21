#!/bin/bash
# Package: @repo/database
# Path: packages/database/scripts/reset-db.sh
# Purpose: Reset database (drop all data and re-initialize)

set -e

echo "⚠️  WARNING: This will delete all data in your database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "🔄 Resetting database..."

# Load environment variables
if [ -f "../../.env" ]; then
  export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Validate database URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo "💥 Dropping and recreating database schema..."
pnpm db:push:force

echo "🌱 Re-seeding database..."
pnpm db:seed

echo "✅ Database reset complete!"
echo ""
echo "🔑 Test credentials:"
echo "  Email: owner@demo-agency.com"
echo "  Password: Test123!@#"