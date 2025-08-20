@echo off
REM planrrr.io Development Setup Script for Windows

echo ======================================
echo    planrrr.io Development Setup
echo ======================================
echo.

REM Check for Node.js
echo Checking prerequisites...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+
    exit /b 1
)

REM Check for pnpm
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo pnpm is not installed. Installing...
    npm install -g pnpm@9.0.0
)

REM Install dependencies
echo.
echo Installing dependencies...
call pnpm install

REM Set up environment files
echo.
echo Setting up environment files...

if not exist "apps\api\.env" (
    copy apps\api\.env.example apps\api\.env
    echo Created apps\api\.env - Please configure with your values
)

if not exist "apps\worker\.env" (
    copy apps\worker\.env.example apps\worker\.env
    echo Created apps\worker\.env - Please configure with your values
)

if not exist "apps\web\.env.local" (
    echo # Development environment > apps\web\.env.local
    echo DATABASE_URL= >> apps\web\.env.local
    echo BETTER_AUTH_SECRET= >> apps\web\.env.local
    echo BETTER_AUTH_URL=http://localhost:3000 >> apps\web\.env.local
    echo NEXT_PUBLIC_API_URL=http://localhost:4000 >> apps\web\.env.local
    echo Created apps\web\.env.local - Please configure with your values
)

REM Generate Prisma client
echo.
echo Generating Prisma client...
call pnpm db:generate

REM Build packages
echo.
echo Building packages...
call pnpm build

REM Run linting
echo.
echo Running linter...
call pnpm lint

echo.
echo ======================================
echo    Setup Complete!
echo ======================================
echo.
echo Next steps:
echo.
echo 1. Configure your .env files with actual values:
echo    - apps\api\.env
echo    - apps\worker\.env
echo    - apps\web\.env.local
echo.
echo 2. Set up your database:
echo    - Create a Neon PostgreSQL database
echo    - Add connection string to DATABASE_URL
echo    - Run: pnpm db:push
echo.
echo 3. Set up Redis:
echo    - Upstash: Add UPSTASH_REDIS_REST_URL and TOKEN
echo    - Or install local Redis
echo.
echo 4. Start development:
echo    pnpm dev
echo.
echo For deployment, see DEPLOYMENT_GUIDE.md
pause