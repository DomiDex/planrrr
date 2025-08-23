-- Initial database setup for planrrr worker
-- This file is executed when the PostgreSQL container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test database for running tests
CREATE DATABASE planrrr_test WITH OWNER planrrr;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE planrrr_dev TO planrrr;
GRANT ALL PRIVILEGES ON DATABASE planrrr_test TO planrrr;

-- Connect to the dev database
\c planrrr_dev;

-- Create schema if needed
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO planrrr;

-- Add any initial data or configurations here
-- Example: Create initial enum types that Prisma might need
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Platform') THEN
        CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE', 'LINKEDIN', 'TIKTOK');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostStatus') THEN
        CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectionStatus') THEN
        CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublicationStatus') THEN
        CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');
    END IF;
END $$;

-- Log successful initialization
DO $$ 
BEGIN 
    RAISE NOTICE 'Database initialization completed successfully'; 
END $$;