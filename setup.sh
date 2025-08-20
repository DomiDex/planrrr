#!/bin/bash

# planrrr.io Development Setup Script
# This script sets up your development environment

set -e

echo "🚀 planrrr.io Development Setup"
echo "================================"
echo ""

# Check for required tools
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing..."
    npm install -g pnpm@9.0.0
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Set up environment files
echo ""
echo "🔧 Setting up environment files..."

if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    echo "✅ Created apps/api/.env - Please configure with your values"
fi

if [ ! -f "apps/worker/.env" ]; then
    cp apps/worker/.env.example apps/worker/.env
    echo "✅ Created apps/worker/.env - Please configure with your values"
fi

if [ ! -f "apps/web/.env.local" ]; then
    echo "# Development environment
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/web/.env.local
    echo "✅ Created apps/web/.env.local - Please configure with your values"
fi

# Generate Prisma client
echo ""
echo "🗄️ Generating Prisma client..."
pnpm db:generate

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm build

# Run linting to verify setup
echo ""
echo "🧹 Running linter..."
pnpm lint || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure your .env files with actual values:"
echo "   - apps/api/.env"
echo "   - apps/worker/.env"
echo "   - apps/web/.env.local"
echo ""
echo "2. Set up your database:"
echo "   - Create a Neon PostgreSQL database"
echo "   - Add the connection string to DATABASE_URL"
echo "   - Run: pnpm db:push"
echo ""
echo "3. Set up Redis (choose one):"
echo "   - Upstash: Add UPSTASH_REDIS_REST_URL and TOKEN"
echo "   - Local: Install Redis and run redis-server"
echo ""
echo "4. Start development:"
echo "   pnpm dev"
echo ""
echo "For deployment instructions, see DEPLOYMENT_GUIDE.md"