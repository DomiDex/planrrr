#!/bin/bash
# Package: @repo/database
# Path: packages/database/scripts/backup-db.sh
# Purpose: Create database backup

set -e

echo "💾 Creating database backup..."

# Load environment variables
if [ -f "../../.env" ]; then
  export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Validate database URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p ../backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="../backups/backup_${TIMESTAMP}.sql"

echo "📦 Creating backup: ${BACKUP_FILE}"

# Parse DATABASE_URL to get connection parameters
# Format: postgresql://username:password@host:port/database
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]%%\?*}"  # Remove query parameters
  
  # Create backup using pg_dump
  PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_FILE"
  
  echo "✅ Backup created successfully: ${BACKUP_FILE}"
  echo ""
  echo "📝 To restore this backup, run:"
  echo "  PGPASSWORD=\"$DB_PASS\" psql -h \"$DB_HOST\" -p \"$DB_PORT\" -U \"$DB_USER\" -d \"$DB_NAME\" < \"$BACKUP_FILE\""
else
  echo "❌ Could not parse DATABASE_URL"
  exit 1
fi