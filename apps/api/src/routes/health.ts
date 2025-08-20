// Package: @repo/api
// Path: apps/api/src/routes/health.ts
// Dependencies: hono, @repo/database

import { Hono } from 'hono';
import { prisma } from '@repo/database';

const health = new Hono();

health.get('/', async (c) => {
  const checks = {
    server: 'ok',
    database: 'checking',
    redis: 'checking',
    timestamp: new Date().toISOString()
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
    console.error('Database health check failed:', error);
  }

  // Check Redis connection (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      });
      checks.redis = response.ok ? 'ok' : 'error';
    } catch (error) {
      checks.redis = 'error';
      console.error('Redis health check failed:', error);
    }
  } else {
    checks.redis = 'not_configured';
  }

  const isHealthy = checks.server === 'ok' && 
                    checks.database === 'ok' && 
                    (checks.redis === 'ok' || checks.redis === 'not_configured');

  return c.json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.API_VERSION || '1.0.0'
  }, isHealthy ? 200 : 503);
});

// Liveness check (simple ping)
health.get('/live', (c) => {
  return c.json({ status: 'alive' });
});

// Readiness check (dependencies ready)
health.get('/ready', async (c) => {
  try {
    // Quick database check
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'ready' });
  } catch {
    return c.json({ status: 'not_ready', error: 'Database connection failed' }, 503);
  }
});

export default health;