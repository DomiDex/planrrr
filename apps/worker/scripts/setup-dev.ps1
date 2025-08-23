# Development Environment Setup Script for Worker Service (Windows)
# This script sets up PostgreSQL and Redis using Docker

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Planrrr Worker Development Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
}
catch {
    Write-Host "Error: Docker is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
}
catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop"
    exit 1
}

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "Please update .env with your configuration if needed" -ForegroundColor Yellow
}

# Function to wait for service
function Wait-ForService {
    param(
        [string]$ServiceName,
        [int]$Port,
        [int]$MaxAttempts = 30
    )
    
    Write-Host -NoNewline "Waiting for $ServiceName on port ${Port}..."
    
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        try {
            $connection = New-Object System.Net.Sockets.TcpClient
            $connection.Connect("localhost", $Port)
            $connection.Close()
            Write-Host " ✓" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host -NoNewline "."
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Host " ✗" -ForegroundColor Red
    Write-Host "Failed to connect to $ServiceName on port $Port" -ForegroundColor Red
    return $false
}

# Start Docker services
Write-Host "`nStarting Docker services..." -ForegroundColor Yellow
docker compose up -d

# Wait for services to be ready
Write-Host "`nWaiting for services to be ready..." -ForegroundColor Yellow

# Wait for PostgreSQL
Wait-ForService -ServiceName "PostgreSQL" -Port 5432
Wait-ForService -ServiceName "PostgreSQL Test" -Port 5433

# Wait for Redis
Wait-ForService -ServiceName "Redis" -Port 6379

# Wait for Admin tools
Wait-ForService -ServiceName "Adminer" -Port 8080
Wait-ForService -ServiceName "Redis Commander" -Port 8081

# Show service status
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Services Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services available at:"
Write-Host "  • PostgreSQL:      localhost:5432"
Write-Host "  • PostgreSQL Test: localhost:5433"
Write-Host "  • Redis:           localhost:6379"
Write-Host "  • Adminer:         http://localhost:8080"
Write-Host "  • Redis Commander: http://localhost:8081"
Write-Host ""
Write-Host "Database credentials:"
Write-Host "  • Username: planrrr"
Write-Host "  • Password: planrrr_dev_password"
Write-Host "  • Database: planrrr_dev (dev) / planrrr_test (test)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run migrations: pnpm db:push"
Write-Host "  2. Generate Prisma client: pnpm db:generate"
Write-Host "  3. Start worker: pnpm dev:worker"
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green