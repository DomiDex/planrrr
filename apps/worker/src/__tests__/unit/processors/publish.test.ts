import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import { 
  
  PostBuilder,
  ConnectionBuilder,
  PublishJobBuilder,
  createMockJob,
  freezeTime,
  restoreTime
} from '../../../test-utils/index.js';

// Mock dependencies
vi.mock('@repo/database', () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    connection: {
      findFirst: vi.fn(),
    },
    publication: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock('@/publishers', () => ({
  FacebookPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'fb_123',
      url: 'https://facebook.com/post/123',
      publishedAt: new Date(),
    }),
  })),
  InstagramPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'ig_123',
      url: 'https://instagram.com/p/123',
      publishedAt: new Date(),
    }),
  })),
  TwitterPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'tw_123',
      url: 'https://twitter.com/status/123',
      publishedAt: new Date(),
    }),
  })),
  YouTubePublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'yt_123',
      url: 'https://youtube.com/watch?v=123',
      publishedAt: new Date(),
    }),
  })),
}));

import { processPublishJob } from '../../../processors/publish.js';
import { prisma } from '@repo/database';

describe('processPublishJob', () => {
  let mockJob: Job;
  let mockPost: ReturnType<typeof PostBuilder.prototype.build>;
  let mockConnection: ReturnType<typeof ConnectionBuilder.prototype.build>;

  beforeEach(() => {
    freezeTime('2024-03-15T10:00:00Z');

    mockPost = new PostBuilder()
      .withContent('Test post content')
      .withPlatforms('FACEBOOK', 'TWITTER')
      .scheduled(new Date('2024-03-15T10:00:00Z'))
      .forTeam('team_123')
      .build();

    mockConnection = new ConnectionBuilder()
      .forPlatform('FACEBOOK')
      .forTeam('team_123')
      .active()
      .build();

    const jobData = new PublishJobBuilder()
      .forPost(mockPost.id)
      .toPlatform('FACEBOOK')
      .scheduledFor(new Date('2024-03-15T10:00:00Z'))
      .build();

    mockJob = createMockJob(jobData) as Job;
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('successful publishing', () => {
    it('should successfully publish a post to a single platform', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);
      (prisma.publication.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pub_123',
        postId: mockPost.id,
        platform: 'FACEBOOK',
        platformPostId: 'fb_123',
        status: 'PUBLISHED',
      });

      const result = await processPublishJob(mockJob);

      expect(result).toEqual({
        success: true,
        platform: 'FACEBOOK',
        platformPostId: 'fb_123',
        url: 'https://facebook.com/post/123',
        publishedAt: expect.any(Date),
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        },
      });

      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle multi-platform publishing', async () => {
      const multiPlatformPost = new PostBuilder()
        .withContent('Multi-platform post')
        .withPlatforms('FACEBOOK', 'TWITTER', 'INSTAGRAM')
        .scheduled(new Date())
        .build();

      mockJob.data.postId = multiPlatformPost.id;
      
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(multiPlatformPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      const result = await processPublishJob(mockJob);

      expect(result.success).toBe(true);
      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should update progress during processing', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await processPublishJob(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(25); // Post fetched
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50); // Connection validated
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75); // Publishing
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100); // Complete
    });
  });

  describe('error handling', () => {
    it('should handle missing post', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow(/Post .* not found/);
      
      expect(mockJob.log).toHaveBeenCalledWith(
        expect.stringContaining('Post not found')
      );
    });

    it('should handle missing connection', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow(
        /No active .* connection for team/
      );

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: { status: 'FAILED' },
      });
    });

    it('should handle inactive connection', async () => {
      const inactiveConnection = new ConnectionBuilder()
        .forPlatform('FACEBOOK')
        .inactive()
        .build();

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(inactiveConnection);

      await expect(processPublishJob(mockJob)).rejects.toThrow(
        'Connection is not active'
      );
    });

    it('should handle publishing failures', async () => {
      const { FacebookPublisher } = await import('../../../publishers/index.js');
      
      (FacebookPublisher as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        publish: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: 'API_ERROR',
            message: 'Failed to publish',
          },
        }),
      }));

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await expect(processPublishJob(mockJob)).rejects.toThrow('Failed to publish');

      expect(prisma.publication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Failed to publish',
          errorCode: 'API_ERROR',
        }),
      });
    });

    it('should handle rate limiting', async () => {
      const { FacebookPublisher } = await import('../../../publishers/index.js');
      
      (FacebookPublisher as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        publish: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            retryAfter: 60,
          },
        }),
      }));

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await expect(processPublishJob(mockJob)).rejects.toThrow('Rate limit');

      expect(mockJob.moveToDelayed).toHaveBeenCalledWith(60000);
    });

    it('should handle transaction failures', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(processPublishJob(mockJob)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });

  describe('retry logic', () => {
    it('should increment retry count on failure', async () => {
      mockJob.data.retryCount = 2;
      mockJob.attemptsMade = 3;

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow();

      expect(prisma.publication.update).toHaveBeenCalledWith({
        where: expect.any(Object),
        data: expect.objectContaining({
          retryCount: 3,
        }),
      });
    });

    it('should mark post as failed after max retries', async () => {
      mockJob.opts = { attempts: 3 };
      mockJob.attemptsMade = 3;

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow();

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: { status: 'FAILED' },
      });
    });

    it('should not retry on permanent failures', async () => {
      const { FacebookPublisher } = await import('../../../publishers/index.js');
      
      (FacebookPublisher as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        publish: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: 'INVALID_CONTENT',
            message: 'Content violates platform policies',
            permanent: true,
          },
        }),
      }));

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await expect(processPublishJob(mockJob)).rejects.toThrow();

      expect(mockJob.discard).toHaveBeenCalled();
    });
  });

  describe('scheduling validation', () => {
    it('should skip posts scheduled for future', async () => {
      const futurePost = new PostBuilder()
        .scheduled(new Date('2024-03-15T12:00:00Z'))
        .build();

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(futurePost);

      const result = await processPublishJob(mockJob);

      expect(result).toEqual({
        skipped: true,
        reason: 'Post scheduled for future',
        scheduledAt: futurePost.scheduledAt,
      });

      expect(mockJob.moveToDelayed).toHaveBeenCalled();
    });

    it('should process posts within scheduling tolerance', async () => {
      const nowPost = new PostBuilder()
        .scheduled(new Date('2024-03-15T10:00:30Z')) // 30 seconds after current time
        .build();

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(nowPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      const result = await processPublishJob(mockJob);

      expect(result.success).toBe(true);
    });

    it('should handle already published posts', async () => {
      const publishedPost = new PostBuilder()
        .published(new Date('2024-03-15T09:00:00Z'))
        .build();

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publishedPost);

      const result = await processPublishJob(mockJob);

      expect(result).toEqual({
        alreadyPublished: true,
      });
    });
  });

  describe('metadata tracking', () => {
    it('should track publishing metadata', async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await processPublishJob(mockJob);

      expect(prisma.publication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            jobId: mockJob.id,
            attemptNumber: mockJob.attemptsMade,
            processedAt: expect.any(String),
          }),
        }),
      });
    });

    it('should include error details in metadata on failure', async () => {
      const { FacebookPublisher } = await import('../../../publishers/index.js');
      
      const errorDetails = {
        response: { status: 400, data: { error: 'Invalid request' } },
      };

      (FacebookPublisher as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        publish: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: 'API_ERROR',
            message: 'Failed to publish',
            details: errorDetails,
          },
        }),
      }));

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);

      await expect(processPublishJob(mockJob)).rejects.toThrow();

      expect(prisma.publication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            errorDetails,
          }),
        }),
      });
    });
  });
});