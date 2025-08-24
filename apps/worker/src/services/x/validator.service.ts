// Package: @repo/worker
// Path: apps/worker/src/services/x/validator.service.ts
// Dependencies: none

import type { MediaRequirements } from '../../types/publisher.js';

export interface XValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface XMediaValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

export class XValidator {
  private readonly tweetLimit = 280;
  private readonly threadMaxTweets = 25;
  private readonly maxImages = 4;
  private readonly maxVideoLength = 140; // seconds
  private readonly maxGifSize = 15; // MB
  private readonly maxVideoSize = 512; // MB
  private readonly maxImageSize = 5; // MB

  validateTweet(content: string, mediaCount = 0): XValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const tweetLength = this.calculateTweetLength(content, mediaCount > 0);
    
    if (tweetLength > this.tweetLimit) {
      errors.push(
        `Tweet exceeds ${this.tweetLimit} character limit (current: ${tweetLength})`
      );
      suggestions.push('Consider creating a thread for longer content');
    }

    if (content.length === 0 && mediaCount === 0) {
      errors.push('Tweet must contain text or media');
    }

    const urls = this.extractUrls(content);
    if (urls.length > 4) {
      warnings.push('Too many URLs may trigger spam detection');
    }

    const hashtags = this.extractHashtags(content);
    if (hashtags.length > 10) {
      warnings.push('Excessive hashtags may reduce engagement');
    } else if (hashtags.length > 3) {
      suggestions.push('Consider using 1-3 hashtags for optimal engagement');
    }

    const mentions = this.extractMentions(content);
    if (mentions.length > 10) {
      warnings.push('Too many mentions may trigger spam filters');
    }

    if (this.containsDuplicateContent(content)) {
      errors.push('Duplicate content detected. X may reject identical tweets');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  validateThread(tweets: string[]): XValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tweets.length > this.threadMaxTweets) {
      errors.push(
        `Thread exceeds ${this.threadMaxTweets} tweet limit (current: ${tweets.length})`
      );
    }

    if (tweets.length < 2) {
      errors.push('Thread must contain at least 2 tweets');
    }

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      if (!tweet) {
        errors.push(`Tweet ${i + 1}: Tweet content is undefined`);
        continue;
      }
      const validation = this.validateTweet(tweet);
      if (!validation.valid) {
        errors.push(`Tweet ${i + 1}: ${validation.errors.join(', ')}`);
      }
    }

    if (tweets.length > 10) {
      warnings.push('Long threads may have reduced engagement');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateImage(filePath: string): XMediaValidation {
    const extension = this.getFileExtension(filePath);
    
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return {
        valid: false,
        error: 'X supports JPG, PNG, GIF, and WEBP images'
      };
    }

    if (extension === 'gif') {
      return {
        valid: true,
        warning: 'GIF will be converted to video format'
      };
    }

    return { valid: true };
  }

  validateVideo(filePath: string): XMediaValidation {
    const extension = this.getFileExtension(filePath);
    
    if (!['mp4', 'mov'].includes(extension)) {
      return {
        valid: false,
        error: 'X only supports MP4 and MOV video formats'
      };
    }

    return { valid: true };
  }

  validateMediaCombination(
    mediaTypes: Array<'image' | 'video' | 'gif'>
  ): XValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const imageCount = mediaTypes.filter(t => t === 'image').length;
    const videoCount = mediaTypes.filter(t => t === 'video').length;
    const gifCount = mediaTypes.filter(t => t === 'gif').length;

    if (videoCount > 1) {
      errors.push('Only one video can be attached per tweet');
    }

    if (gifCount > 1) {
      errors.push('Only one GIF can be attached per tweet');
    }

    if (imageCount > this.maxImages) {
      errors.push(`Maximum ${this.maxImages} images per tweet`);
    }

    if (videoCount > 0 && imageCount > 0) {
      errors.push('Cannot mix video and images in the same tweet');
    }

    if (gifCount > 0 && (imageCount > 0 || videoCount > 0)) {
      errors.push('GIFs cannot be combined with other media');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getMediaRequirements(): MediaRequirements {
    return {
      images: {
        minWidth: 32,
        minHeight: 32,
        maxWidth: 8192,
        maxHeight: 8192,
        maxSizeMB: 5,
        formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
      },
      videos: {
        minDuration: 0.5,
        maxDuration: 140,
        maxSizeMB: 512,
        minWidth: 32,
        minHeight: 32,
        maxWidth: 1920,
        maxHeight: 1200,
        formats: ['mp4', 'mov'],
        frameRate: {
          min: 1,
          max: 60
        }
      },
      maxCount: 4
    };
  }

  private calculateTweetLength(content: string, hasMedia: boolean): number {
    let length = Array.from(content).length;
    
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
      const urlLength = Array.from(url).length;
      length = length - urlLength + 23;
    }
    
    if (hasMedia) {
      length += 24;
    }

    return length;
  }

  private extractUrls(content: string): string[] {
    const regex = /https?:\/\/[^\s]+/g;
    const matches = content.match(regex) || [];
    return matches;
  }

  private extractHashtags(content: string): string[] {
    const regex = /#[\w]+/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private extractMentions(content: string): string[] {
    const regex = /@[\w]+/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private getFileExtension(filePath: string): string {
    const match = filePath.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
    return match?.[1] ?? '';
  }

  private containsDuplicateContent(_content: string): boolean {
    return false;
  }

  isWithinRateLimit(
    postsToday: number,
    accessTier: 'free' | 'basic' | 'pro' = 'basic'
  ): boolean {
    const limits = {
      free: 50,
      basic: 100,
      pro: 1500
    };

    return postsToday < limits[accessTier];
  }

  validatePoll(
    question: string,
    options: string[]
  ): XValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const totalLength = this.calculateTweetLength(question, false);
    if (totalLength > 280) {
      errors.push('Poll question exceeds character limit');
    }

    if (options.length < 2) {
      errors.push('Polls must have at least 2 options');
    }

    if (options.length > 4) {
      errors.push('Polls cannot have more than 4 options');
    }

    for (const [index, option] of options.entries()) {
      if (option.length > 25) {
        errors.push(`Poll option ${index + 1} exceeds 25 character limit`);
      }
      if (option.length === 0) {
        errors.push(`Poll option ${index + 1} cannot be empty`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}