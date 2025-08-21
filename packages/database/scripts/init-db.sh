#!/bin/bash
# Package: @repo/database
# Path: packages/database/scripts/init-db.sh
# Purpose: Initialize database with schema and seed data

set -e

echo "🚀 Initializing database..."

# Load environment variables
if [ -f "../../.env" ]; then
  export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Validate database URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🔄 Generating Prisma Client..."
pnpm db:generate

echo "📊 Validating schema..."
pnpm db:validate

echo "🗄️ Pushing schema to database..."
pnpm db:push

echo "🌱 Seeding database..."
pnpm db:seed

echo "✅ Database initialization complete!"
echo ""
echo "📝 Next steps:"
echo "  - Run 'pnpm db:studio' to open Prisma Studio"
echo "  - Run 'pnpm dev' to start the development server"
echo ""
echo "🔑 Test credentials:"
echo "  Email: owner@demo-agency.com"
echo "  Password: Test123!@#"