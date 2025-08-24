// Package: @repo/worker
// Path: apps/worker/src/processors/publish.ts
// Dependencies: @repo/database, bullmq

import { prisma } from '@repo/database';
import type { Job } from 'bullmq';
import type { Platform } from '@repo/database';
import { FacebookPublisher } from '../publishers/facebook.publisher.js';
import { XPublisher } from '../publishers/x.publisher.js';
import { InstagramPublisher } from '../publishers/instagram.publisher.js';
import { YouTubePublisher } from '../publishers/youtube.publisher.js';
import { LinkedInPublisher } from '../publishers/linkedin.publisher.js';

export interface PublishJobData {
  postId: string;
  platform: Platform;
}

export interface PublishResult {
  success?: boolean;
  publishedAt?: Date;
  platform?: Platform;
  alreadyPublished?: boolean;
  error?: string;
}

export async function processPublishJob(job: Job<PublishJobData>): Promise<PublishResult> {
  const { postId, platform } = job.data;
  console.log(`Processing job ${job.id}: Publishing post ${postId} to ${platform}`);

  try {
    await job.updateProgress(10);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        team: true,
        user: true,
        publications: true
      }
    });

    if (!post) {
      const errorMsg = `Post ${postId} not found`;
      await job.log(errorMsg);
      throw new Error(errorMsg);
    }

    if (post.status === 'PUBLISHED') {
      console.log(`Post ${postId} already published`);
      return { alreadyPublished: true };
    }

    await job.updateProgress(30);

    const connection = await prisma.connection.findFirst({
      where: {
        teamId: post.teamId,
        platform,
        status: 'ACTIVE'
      }
    });

    if (!connection) {
      throw new Error(`No active ${platform} connection for team ${post.teamId}`);
    }

    await job.updateProgress(50);

    // Use platform-specific publisher
    let publisher;
    switch (platform) {
      case 'FACEBOOK':
        publisher = new FacebookPublisher();
        break;
      case 'TWITTER':
        publisher = new XPublisher(); // XPublisher handles Twitter
        break;
      case 'INSTAGRAM':
        publisher = new InstagramPublisher();
        break;
      case 'YOUTUBE':
        publisher = new YouTubePublisher();
        break;
      case 'LINKEDIN':
        publisher = new LinkedInPublisher();
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    const result = await publisher.publish(post, connection);
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error?.message || 'Failed to publish';
      throw new Error(errorMessage);
    }
    
    const externalId = result.platformPostId || '';

    await job.updateProgress(80);

    await prisma.$transaction([
      prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      }),
      prisma.publication.create({
        data: {
          postId,
          platform,
          externalId,
          publishedAt: new Date(),
          status: 'PUBLISHED',
          url: `https://${platform.toLowerCase()}.com/post/${externalId}`
        }
      })
    ]);

    await job.updateProgress(100);

    console.log(`✅ Successfully published post ${postId} to ${platform}`);
    return {
      success: true,
      publishedAt: new Date(),
      platform
    };

  } catch (error) {
    console.error(`❌ Failed to publish post ${postId}:`, error);
    
    await prisma.publication.create({
      data: {
        postId,
        platform,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    throw error;
  }
}