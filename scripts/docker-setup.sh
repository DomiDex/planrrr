#!/bin/bash

# Docker Compose Setup Script for planrrr.io
# This script prepares the local development environment

set -e

echo "🚀 Setting up planrrr.io Docker development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    # Use docker compose instead of docker-compose
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

print_status "Docker and Docker Compose are installed"

# Create data directories with proper permissions
echo "Creating data directories..."
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/minio

print_status "Data directories created"

# Check if .env.docker exists, if not copy from example
if [ ! -f .env.docker ]; then
    if [ -f .env.docker.example ]; then
        cp .env.docker.example .env.docker
        print_warning ".env.docker created from .env.docker.example - please review and update values"
    else
        print_error ".env.docker.example not found. Creating basic .env.docker"
        cat > .env.docker << 'EOF'
# Basic Docker Environment Configuration
POSTGRES_USER=planrrr
POSTGRES_PASSWORD=localdev123
POSTGRES_DB=planrrr_dev
REDIS_PASSWORD=localdev123
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_SECRET_KEY=planrrr_secret123
EOF
    fi
fi

print_status "Environment file ready"

# Stop any existing containers
echo "Stopping any existing containers..."
$COMPOSE_CMD down 2>/dev/null || true

# Pull latest images
echo "Pulling Docker images..."
$COMPOSE_CMD pull

print_status "Docker images updated"

# Start services
echo "Starting Docker services..."
$COMPOSE_CMD --env-file .env.docker up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 5

# Check service health
RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
    if $COMPOSE_CMD exec -T postgres pg_isready -U planrrr -d planrrr_dev &>/dev/null; then
        print_status "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $RETRIES ]; then
    print_error "PostgreSQL failed to start"
    exit 1
fi

# Check Redis
if $COMPOSE_CMD exec -T redis redis-cli -a localdev123 ping &>/dev/null; then
    print_status "Redis is ready"
else
    print_error "Redis is not responding"
fi

# Create MinIO buckets
echo "Setting up MinIO buckets..."
$COMPOSE_CMD run --rm minio-setup 2>/dev/null || print_warning "MinIO buckets may already exist"

# Show service status
echo ""
echo "📊 Service Status:"
$COMPOSE_CMD ps

echo ""
echo "🎉 Docker development environment is ready!"
echo ""
echo "📚 Quick Reference:"
echo "  Web App:        http://localhost:3000"
echo "  API Service:    http://localhost:3001"
echo "  Mailhog UI:     http://localhost:8025"
echo "  MinIO Console:  http://localhost:9001"
echo "  PostgreSQL:     localhost:5432"
echo "  Redis:          localhost:6379"
echo ""
echo "🛠️  Useful Commands:"
echo "  pnpm docker:logs       - View all logs"
echo "  pnpm docker:ps         - Check service status"
echo "  pnpm docker:down       - Stop all services"
echo "  pnpm docker:reset      - Reset all data and restart"
echo "  pnpm db:local          - Connect to PostgreSQL"
echo "  pnpm redis:local       - Connect to Redis CLI"
echo "  pnpm dev:local         - Start services and run dev"
echo ""
echo "📝 MinIO Credentials:"
echo "  Console: http://localhost:9001"
echo "  Username: minioadmin"
echo "  Password: minioadmin123"
echo ""

# Check if we're in WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
    print_warning "WSL detected: Make sure Docker Desktop is running on Windows"
fi

exit 0