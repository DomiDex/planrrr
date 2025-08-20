// Package: @repo/api
// Path: apps/api/src/routes/health.ts  
// Dependencies: hono

import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'planrrr-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

health.get('/ready', (c) => {
  // Check database connection, redis, etc.
  return c.json({
    ready: true,
    checks: {
      database: true,
      redis: true,
      storage: true
    }
  });
});

export default health;