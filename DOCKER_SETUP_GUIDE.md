# Docker Development Environment Setup Guide

This guide provides comprehensive instructions for setting up and using the Docker Compose development environment for planrrr.io.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

1. **Docker Desktop** (includes Docker Compose)
   - [Windows](https://docs.docker.com/desktop/install/windows-install/)
   - [Mac](https://docs.docker.com/desktop/install/mac-install/)
   - [Linux](https://docs.docker.com/desktop/install/linux-install/)

2. **Node.js 18+** and **pnpm**
   ```bash
   # Install pnpm if not already installed
   npm install -g pnpm@9.0.0
   ```

3. **Git** for version control

## 🚀 Quick Start

### Automatic Setup

#### Windows
```batch
# Run the setup script
.\scripts\docker-setup.bat
```

#### Mac/Linux/WSL
```bash
# Make the script executable
chmod +x scripts/docker-setup.sh

# Run the setup script
./scripts/docker-setup.sh
```

### Manual Setup

1. **Copy environment configuration**
   ```bash
   cp .env.docker.example .env.docker
   ```

2. **Create data directories**
   ```bash
   mkdir -p data/postgres data/redis data/minio
   ```

3. **Start all services**
   ```bash
   pnpm docker:up
   ```

4. **Verify services are running**
   ```bash
   pnpm docker:ps
   ```

## 🏗️ Architecture Overview

The Docker Compose setup includes the following services:

| Service | Purpose | Port | Health Check |
|---------|---------|------|--------------|
| **PostgreSQL** | Primary database | 5432 | ✅ Built-in |
| **Redis** | Cache & job queue | 6379 | ✅ Built-in |
| **Mailhog** | Email testing | 1025 (SMTP), 8025 (UI) | ✅ Built-in |
| **MinIO** | S3-compatible storage | 9000 (API), 9001 (Console) | ✅ Built-in |

## 📝 Environment Configuration

### Main Configuration File: `.env.docker`

The `.env.docker` file contains all configuration for local development. Key sections:

```bash
# Database
DATABASE_URL=postgresql://planrrr:localdev123@localhost:5432/planrrr_dev

# Redis  
REDIS_URL=redis://:localdev123@localhost:6379

# Email (Mailhog)
SMTP_HOST=localhost
SMTP_PORT=1025

# Storage (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET_NAME=planrrr-local
```

### Application-Specific Configuration

For the web app (`apps/web/.env.local`):
```bash
# Copy values from .env.docker
DATABASE_URL=postgresql://planrrr:localdev123@localhost:5432/planrrr_dev
REDIS_URL=redis://:localdev123@localhost:6379
# Add app-specific values
BETTER_AUTH_SECRET=your_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For the worker (`apps/worker/.env`):
```bash
# Copy values from .env.docker
DATABASE_URL=postgresql://planrrr:localdev123@localhost:5432/planrrr_dev
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=localdev123
```

## 🎯 Common Tasks

### Starting Services

```bash
# Start all services
pnpm docker:up

# Start specific services only
pnpm dev:services  # Start postgres, redis, mailhog, minio

# Start services and run development servers
pnpm dev:local
```

### Stopping Services

```bash
# Stop all services (preserves data)
pnpm docker:down

# Stop services temporarily
pnpm docker:stop

# Restart services
pnpm docker:restart
```

### Viewing Logs

```bash
# View all service logs
pnpm docker:logs

# View specific service logs
pnpm docker:logs:postgres
pnpm docker:logs:redis

# Follow logs in real-time
docker-compose logs -f [service-name]
```

### Database Operations

```bash
# Connect to PostgreSQL
pnpm db:local

# Run Prisma migrations
pnpm db:push

# Open Prisma Studio
pnpm db:studio

# Direct SQL access
docker-compose exec postgres psql -U planrrr -d planrrr_dev
```

### Redis Operations

```bash
# Connect to Redis CLI
pnpm redis:local

# Monitor Redis in real-time
docker-compose exec redis redis-cli -a localdev123 monitor

# Clear Redis cache
docker-compose exec redis redis-cli -a localdev123 FLUSHALL
```

### Storage Operations

```bash
# Access MinIO Console
# Open: http://localhost:9001
# Login: minioadmin / minioadmin123

# Create buckets manually
pnpm minio:create-buckets

# Upload test file
curl -X PUT http://localhost:9000/planrrr-local/test.txt \
  -H "Content-Type: text/plain" \
  -d "Hello MinIO"
```

### Email Testing

```bash
# Access Mailhog UI
# Open: http://localhost:8025

# Send test email (from application)
# SMTP Server: localhost:1025
# No authentication required
```

## 🔧 Troubleshooting

### Service Won't Start

1. **Check if ports are in use**
   ```bash
   # Windows
   netstat -ano | findstr :5432
   
   # Mac/Linux
   lsof -i :5432
   ```

2. **Check Docker daemon**
   ```bash
   docker version
   docker-compose version
   ```

3. **Reset everything**
   ```bash
   pnpm docker:reset
   ```

### Database Connection Issues

1. **Verify PostgreSQL is running**
   ```bash
   docker-compose exec postgres pg_isready
   ```

2. **Check connection string**
   ```bash
   # Should be: postgresql://planrrr:localdev123@localhost:5432/planrrr_dev
   echo $DATABASE_URL
   ```

3. **Reset database**
   ```bash
   docker-compose down -v postgres
   docker-compose up -d postgres
   ```

### Redis Connection Issues

1. **Test Redis connection**
   ```bash
   docker-compose exec redis redis-cli -a localdev123 ping
   # Should return: PONG
   ```

2. **Check Redis logs**
   ```bash
   docker-compose logs redis
   ```

### MinIO Issues

1. **Reset MinIO data**
   ```bash
   docker-compose down minio
   rm -rf data/minio/*
   docker-compose up -d minio minio-setup
   ```

2. **Verify buckets exist**
   ```bash
   # Access console at http://localhost:9001
   # Check for: planrrr-local, planrrr-media, planrrr-uploads
   ```

### WSL2 Specific Issues

1. **Slow performance**
   - Store project files in WSL filesystem (`/home/username/`) not Windows (`/mnt/c/`)
   - Increase Docker Desktop WSL2 memory allocation

2. **Clock sync issues**
   ```bash
   # Fix WSL2 clock drift
   sudo hwclock -s
   ```

3. **Network issues**
   ```bash
   # Restart WSL2
   wsl --shutdown
   # Then restart Docker Desktop
   ```

## 🧹 Cleanup

### Remove Containers Only
```bash
pnpm docker:down
```

### Remove Everything (including data)
```bash
pnpm docker:clean
```

### Complete Docker Cleanup
```bash
# Remove all planrrr containers, volumes, and images
pnpm docker:prune
```

### Manual Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Clean data directories
rm -rf data/
```

## 📊 Health Monitoring

### Check Service Health
```bash
pnpm docker:health
```

### Manual Health Checks

**PostgreSQL:**
```bash
docker-compose exec postgres pg_isready -U planrrr
```

**Redis:**
```bash
docker-compose exec redis redis-cli -a localdev123 ping
```

**MinIO:**
```bash
curl -I http://localhost:9000/minio/health/live
```

**Mailhog:**
```bash
curl -I http://localhost:8025/api/v2/messages
```

## 🔐 Security Notes

⚠️ **Development Only Configuration**

The provided passwords and secrets are for local development only:
- Database password: `localdev123`
- Redis password: `localdev123`  
- MinIO credentials: `minioadmin` / `minioadmin123`

**Never use these credentials in production!**

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [Mailhog Documentation](https://github.com/mailhog/MailHog)
- [MinIO Docker Guide](https://min.io/docs/minio/container/index.html)

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `pnpm docker:logs`
2. Verify service status: `pnpm docker:ps`
3. Try resetting: `pnpm docker:reset`
4. Check this guide's troubleshooting section
5. Open an issue on GitHub with:
   - Your OS and Docker version
   - Error messages from logs
   - Steps to reproduce the issue

## ✅ Validation Checklist

After setup, verify everything works:

- [ ] All services show as "Up" in `pnpm docker:ps`
- [ ] PostgreSQL accepts connections: `pnpm db:local`
- [ ] Redis responds to ping: `pnpm redis:local` then `ping`
- [ ] Mailhog UI loads at http://localhost:8025
- [ ] MinIO Console loads at http://localhost:9001
- [ ] Buckets exist in MinIO (planrrr-local, planrrr-media, planrrr-uploads)
- [ ] Application can connect to database
- [ ] Worker can connect to Redis

## 🎉 Success!

Your Docker development environment is now ready. You can:

1. Start developing: `pnpm dev:local`
2. Access services at their respective URLs
3. Use the convenience scripts in `package.json`

Happy coding! 🚀