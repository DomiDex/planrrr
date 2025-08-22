// Package: @repo/api
// Path: apps/api/src/procedures/index.ts
// Dependencies: @orpc/server, zod

import { os } from '@orpc/server';
import { z } from 'zod';
import { authRouter } from './auth.procedure.js';
import { postsRouter } from './posts.procedure.js';
import { teamRouter } from './team.procedure.js';
import { connectionsRouter } from './connections.procedure.js';
import { aiRouter } from './ai.procedure.js';
import { publicProcedure } from './context.js';

// Health check procedure
const healthCheck = publicProcedure
  .output(z.object({
    status: z.string(),
    timestamp: z.string(),
    version: z.string().optional()
  }))
  .handler(async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  }));

// Main API router combining all sub-routers
export const apiRouter = os.router({
  // Health check
  health: healthCheck,
  
  // Sub-routers
  auth: authRouter,
  posts: postsRouter,
  team: teamRouter,
  connections: connectionsRouter,
  ai: aiRouter
});

// Export type for client
export type ApiRouter = typeof apiRouter;