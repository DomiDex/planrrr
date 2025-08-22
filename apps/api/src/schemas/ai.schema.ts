// Package: @repo/api
// Path: apps/api/src/schemas/ai.schema.ts
// Dependencies: zod

import { z } from 'zod';

// AI content generation schemas
export const GenerateContentSchema = z.object({
  prompt: z.string().min(1).max(1000),
  platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'])),
  tone: z.enum(['professional', 'casual', 'humorous', 'informative', 'promotional']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional(),
  context: z.string().max(2000).optional()
});

export const GeneratedContentSchema = z.object({
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']),
  content: z.string(),
  characterCount: z.number(),
  hashtags: z.array(z.string()).optional(),
  metadata: z.object({
    tone: z.string().optional(),
    readability: z.number().optional(),
    estimatedEngagement: z.number().optional()
  }).optional()
});

// AI content improvement schemas
export const ImproveContentSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']),
  improvements: z.array(z.enum([
    'grammar',
    'clarity',
    'engagement',
    'hashtags',
    'emojis',
    'length',
    'tone'
  ])).optional()
});

export const ImprovedContentSchema = z.object({
  original: z.string(),
  improved: z.string(),
  changes: z.array(z.object({
    type: z.string(),
    description: z.string()
  })),
  score: z.object({
    before: z.number(),
    after: z.number()
  }).optional()
});

// AI hashtag generation schemas
export const GenerateHashtagsSchema = z.object({
  content: z.string().min(1).max(5000),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']),
  count: z.number().min(1).max(30).optional(),
  trending: z.boolean().optional()
});

export const HashtagSuggestionsSchema = z.object({
  hashtags: z.array(z.object({
    tag: z.string(),
    relevance: z.number(),
    popularity: z.enum(['low', 'medium', 'high']),
    trending: z.boolean()
  })),
  recommended: z.array(z.string())
});

// AI caption generation schemas
export const GenerateCaptionSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageDescription: z.string().optional(),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']),
  style: z.enum(['descriptive', 'storytelling', 'promotional', 'informative']).optional(),
  includeHashtags: z.boolean().optional(),
  maxLength: z.number().optional()
});

export const CaptionResponseSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()).optional(),
  characterCount: z.number()
});

// AI content analysis schemas
export const AnalyzeContentSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'])
});

export const ContentAnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  readability: z.object({
    score: z.number(),
    level: z.enum(['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'])
  }),
  engagement: z.object({
    score: z.number(),
    factors: z.array(z.string())
  }),
  suggestions: z.array(z.object({
    type: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high'])
  })),
  platformFit: z.object({
    score: z.number(),
    issues: z.array(z.string()).optional()
  })
});

// AI scheduling optimization schemas
export const OptimizeScheduleSchema = z.object({
  teamId: z.string().uuid(),
  posts: z.array(z.object({
    id: z.string(),
    content: z.string(),
    platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']))
  })),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  timezone: z.string().optional()
});

export const OptimizedScheduleSchema = z.object({
  schedule: z.array(z.object({
    postId: z.string(),
    platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']),
    suggestedTime: z.string().datetime(),
    reason: z.string(),
    expectedEngagement: z.number()
  })),
  insights: z.array(z.string())
});