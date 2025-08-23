#!/bin/bash

# Shutdown Development Environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Shutting down development services...${NC}"

# Check which docker compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Stop services
$DOCKER_COMPOSE down

echo -e "${GREEN}✓ Services stopped${NC}"

# Ask if user wants to remove volumes
read -p "Do you want to remove data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Removing volumes...${NC}"
    $DOCKER_COMPOSE down -v
    echo -e "${GREEN}✓ Volumes removed${NC}"
fi

echo -e "${GREEN}Development environment shut down successfully${NC}"