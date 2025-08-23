#!/bin/bash

# Development Environment Setup Script for Worker Service
# This script sets up PostgreSQL and Redis using Docker

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Planrrr Worker Development Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://www.docker.com/get-started"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    # Try docker compose (newer version)
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        echo "Please install Docker Compose"
        exit 1
    fi
    # Use newer docker compose command
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Please update .env with your configuration if needed${NC}"
fi

# Function to wait for service
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "Waiting for $service on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}Failed to connect to $service on port $port${NC}"
    return 1
}

# Start Docker services
echo -e "\n${YELLOW}Starting Docker services...${NC}"
$DOCKER_COMPOSE up -d

# Wait for services to be ready
echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"

# Wait for PostgreSQL
wait_for_service "PostgreSQL" 5432
wait_for_service "PostgreSQL Test" 5433

# Wait for Redis
wait_for_service "Redis" 6379

# Wait for Admin tools
wait_for_service "Adminer" 8080
wait_for_service "Redis Commander" 8081

# Show service status
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Services Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Services available at:"
echo "  • PostgreSQL:      localhost:5432"
echo "  • PostgreSQL Test: localhost:5433"
echo "  • Redis:           localhost:6379"
echo "  • Adminer:         http://localhost:8080"
echo "  • Redis Commander: http://localhost:8081"
echo ""
echo "Database credentials:"
echo "  • Username: planrrr"
echo "  • Password: planrrr_dev_password"
echo "  • Database: planrrr_dev (dev) / planrrr_test (test)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run migrations: pnpm db:push"
echo "  2. Generate Prisma client: pnpm db:generate"
echo "  3. Start worker: pnpm dev:worker"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"