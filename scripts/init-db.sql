-- planrrr.io Database Initialization Script
-- This script sets up the initial database configuration for local development

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default configuration
ALTER DATABASE planrrr_dev SET timezone TO 'UTC';

-- Create custom types if needed
DO $$ 
BEGIN
    -- Create enum types for the application
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
        CREATE TYPE post_status AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_type') THEN
        CREATE TYPE platform_type AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE', 'LINKEDIN', 'TIKTOK');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
    END IF;
END $$;

-- Create development-specific settings
DO $$
BEGIN
    -- Set statement timeout for development (longer than production)
    ALTER DATABASE planrrr_dev SET statement_timeout = '30s';
    
    -- Set lock timeout
    ALTER DATABASE planrrr_dev SET lock_timeout = '10s';
    
    -- Enable query logging for development
    ALTER DATABASE planrrr_dev SET log_statement = 'all';
    
    -- Set connection limits appropriate for development
    ALTER DATABASE planrrr_dev SET max_connections = 100;
END $$;

-- Create schemas if needed
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO planrrr;
GRANT ALL ON SCHEMA auth TO planrrr;

-- Add helpful comments
COMMENT ON DATABASE planrrr_dev IS 'planrrr.io local development database';

-- Create initial test data tables (optional, for development)
CREATE TABLE IF NOT EXISTS _development_seeds (
    id SERIAL PRIMARY KEY,
    seed_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);

-- Log initialization
INSERT INTO _development_seeds (seed_name, checksum) 
VALUES ('init_db', MD5('initial_setup_v1'))
ON CONFLICT (seed_name) DO NOTHING;

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
    RAISE NOTICE 'Database: planrrr_dev';
    RAISE NOTICE 'User: planrrr';
    RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto';
    RAISE NOTICE 'Schemas: public, auth';
END $$;