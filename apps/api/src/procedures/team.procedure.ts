// Package: @repo/api
// Path: apps/api/src/procedures/team.procedure.ts
// Dependencies: @orpc/server, @repo/database

import { os, ORPCError } from '@orpc/server';
import { z } from 'zod';
import { prisma } from '@repo/database';
import { protectedProcedure, teamProcedure } from './middleware/auth.middleware.js';
import { logger } from '../lib/logger.js';

// Team schemas
const CreateTeamSchema = z.object({
  name: z.string().min(2).max(100)
});

const UpdateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional()
});

// Team router
export const teamRouter = os.router({
  // Get current team
  current: teamProcedure
    .handler(async ({ context }) => {
      if (!context.user?.team) {
        throw new ORPCError('NOT_FOUND', { message: 'Team not found' });
      }
      
      return context.user.team;
    }),
  
  // Create team
  create: protectedProcedure
    .input(CreateTeamSchema)
    .handler(async ({ input, context }) => {
      // Check if user already has a team
      if (context.user?.teamId) {
        throw new ORPCError('CONFLICT', { message: 'User already belongs to a team' });
      }
      
      // Create team and add user
      const team = await prisma.team.create({
        data: {
          name: input.name,
          slug: input.name.toLowerCase().replace(/\s+/g, '-'),
          users: {
            connect: { id: context.user!.id }
          }
        }
      });
      
      logger.info('Team created', {
        teamId: team.id,
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return team;
    }),
  
  // Update team
  update: teamProcedure
    .input(UpdateTeamSchema)
    .handler(async ({ input, context }) => {
      const team = await prisma.team.update({
        where: { id: context.user!.teamId! },
        data: input
      });
      
      logger.info('Team updated', {
        teamId: team.id,
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return team;
    }),
  
  // Get team members
  members: teamProcedure
    .handler(async ({ context }) => {
      const users = await prisma.user.findMany({
        where: { teamId: context.user?.teamId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      });
      
      return users;
    }),
  
  // Leave team
  leave: teamProcedure
    .handler(async ({ context }) => {
      await prisma.user.update({
        where: { id: context.user?.id },
        data: { teamId: null }
      });
      
      logger.info('User left team', {
        userId: context.user?.id,
        teamId: context.user?.teamId,
        requestId: context.requestId
      });
      
      return { success: true };
    })
});