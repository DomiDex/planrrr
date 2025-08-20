#!/bin/bash

# planrrr.io Deployment Script
# Usage: ./deploy.sh [api|worker|web|all]

set -e

echo "🚀 planrrr.io Deployment Script"
echo "================================"

# Check if environment is configured
check_env() {
    if [ ! -f ".env" ]; then
        echo "❌ Error: .env file not found"
        echo "Please copy .env.example to .env and configure it"
        exit 1
    fi
}

# Build all packages
build_all() {
    echo "📦 Building all packages..."
    pnpm install --frozen-lockfile
    pnpm db:generate
    pnpm build
}

# Deploy API and Worker to Railway
deploy_railway() {
    echo "🚂 Deploying API and Worker to Railway..."
    
    if ! command -v railway &> /dev/null; then
        echo "❌ Railway CLI not found. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    
    railway up
    echo "✅ Railway deployment complete"
    
    # Get service URLs
    echo "📋 Service URLs:"
    railway domain
}

# Deploy frontend to Vercel
deploy_vercel() {
    echo "▲ Deploying frontend to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        echo "❌ Vercel CLI not found. Please install it first:"
        echo "npm install -g vercel"
        exit 1
    fi
    
    cd apps/web
    vercel --prod
    cd ../..
    echo "✅ Vercel deployment complete"
}

# Main deployment logic
case "${1:-all}" in
    api|worker)
        check_env
        build_all
        deploy_railway
        ;;
    web)
        build_all
        deploy_vercel
        ;;
    all)
        check_env
        build_all
        deploy_railway
        deploy_vercel
        ;;
    *)
        echo "Usage: $0 [api|worker|web|all]"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Verify health endpoints are responding"
echo "2. Check application logs for any errors"
echo "3. Test core functionality"
echo ""
echo "Monitoring:"
echo "- Railway logs: railway logs"
echo "- Vercel logs: vercel logs"