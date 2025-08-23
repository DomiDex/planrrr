// Package: @repo/worker
// Path: apps/worker/src/publishers/youtube.ts
// Dependencies: @repo/database

import type { Post, Connection } from '@repo/database';
import type { SocialMediaPublisher, ValidationResult } from './types.js';

export class YouTubePublisher implements SocialMediaPublisher {
  private readonly characterLimit = 5000;

  async publish(post: Post, _connection: Connection): Promise<string> {
    // TODO: Implement actual YouTube API integration using connection
    console.log(`Publishing to YouTube: ${post.content.substring(0, 100)}...`);
    
    if (!post.mediaUrls || post.mediaUrls.length === 0) {
      throw new Error('YouTube requires a video to publish');
    }
    
    const videoUrl = post.mediaUrls[0];
    if (!videoUrl || !this.isVideoUrl(videoUrl)) {
      throw new Error('YouTube requires a valid video file');
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock external ID
    return `yt_${Date.now()}`;
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
  }

  validate(content: string): ValidationResult {
    const characterCount = content.length;
    const valid = characterCount <= this.characterLimit;

    return {
      valid,
      characterCount,
      characterLimit: this.characterLimit,
      ...(valid ? {} : { error: 'Content exceeds YouTube description limit' })
    };
  }

  getCharacterLimit(): number {
    return this.characterLimit;
  }
}