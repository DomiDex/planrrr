@echo off
REM Docker Compose Setup Script for planrrr.io (Windows)
REM This script prepares the local development environment

echo.
echo ===================================================
echo  Setting up planrrr.io Docker development environment
echo ===================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop for Windows first
    echo https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    docker compose version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: Docker Compose is not available
        echo Please ensure Docker Desktop is properly installed
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo [OK] Docker and Docker Compose are installed
echo.

REM Create data directories
echo Creating data directories...
if not exist "data" mkdir data
if not exist "data\postgres" mkdir data\postgres
if not exist "data\redis" mkdir data\redis
if not exist "data\minio" mkdir data\minio
echo [OK] Data directories created
echo.

REM Check if .env.docker exists
if not exist ".env.docker" (
    if exist ".env.docker.example" (
        copy ".env.docker.example" ".env.docker" >nul
        echo [WARNING] .env.docker created from .env.docker.example
        echo Please review and update the values as needed
    ) else (
        echo [ERROR] .env.docker.example not found
        echo Creating basic .env.docker file...
        (
            echo # Basic Docker Environment Configuration
            echo POSTGRES_USER=planrrr
            echo POSTGRES_PASSWORD=localdev123
            echo POSTGRES_DB=planrrr_dev
            echo REDIS_PASSWORD=localdev123
            echo MINIO_ROOT_PASSWORD=minioadmin123
            echo MINIO_SECRET_KEY=planrrr_secret123
        ) > .env.docker
    )
)
echo [OK] Environment file ready
echo.

REM Stop any existing containers
echo Stopping any existing containers...
%COMPOSE_CMD% down >nul 2>&1
echo [OK] Existing containers stopped
echo.

REM Pull latest images
echo Pulling Docker images (this may take a few minutes)...
%COMPOSE_CMD% pull
if %errorlevel% neq 0 (
    echo [ERROR] Failed to pull Docker images
    pause
    exit /b 1
)
echo [OK] Docker images updated
echo.

REM Start services
echo Starting Docker services...
%COMPOSE_CMD% --env-file .env.docker up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker services
    echo Run 'docker-compose logs' to see what went wrong
    pause
    exit /b 1
)
echo [OK] Docker services started
echo.

REM Wait for services to be ready
echo Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

REM Check PostgreSQL
echo Checking PostgreSQL...
%COMPOSE_CMD% exec -T postgres pg_isready -U planrrr -d planrrr_dev >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL is ready
) else (
    echo [WARNING] PostgreSQL may still be starting up
)

REM Check Redis
echo Checking Redis...
%COMPOSE_CMD% exec -T redis redis-cli -a localdev123 ping >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Redis is ready
) else (
    echo [WARNING] Redis may still be starting up
)
echo.

REM Setup MinIO buckets
echo Setting up MinIO buckets...
%COMPOSE_CMD% run --rm minio-setup >nul 2>&1
echo [OK] MinIO buckets configured
echo.

REM Show service status
echo ===================================================
echo  Service Status:
echo ===================================================
%COMPOSE_CMD% ps
echo.

echo ===================================================
echo  Docker development environment is ready!
echo ===================================================
echo.
echo Quick Reference:
echo   Web App:        http://localhost:3000
echo   API Service:    http://localhost:3001  
echo   Mailhog UI:     http://localhost:8025
echo   MinIO Console:  http://localhost:9001
echo   PostgreSQL:     localhost:5432
echo   Redis:          localhost:6379
echo.
echo Useful Commands:
echo   pnpm docker:logs       - View all logs
echo   pnpm docker:ps         - Check service status
echo   pnpm docker:down       - Stop all services
echo   pnpm docker:reset      - Reset all data and restart
echo   pnpm db:local          - Connect to PostgreSQL
echo   pnpm redis:local       - Connect to Redis CLI
echo   pnpm dev:local         - Start services and run dev
echo.
echo MinIO Credentials:
echo   Console: http://localhost:9001
echo   Username: minioadmin
echo   Password: minioadmin123
echo.

pause