// Package: @repo/worker
// Path: apps/worker/src/services/youtube/validator.service.ts
// Dependencies: none

import { PublisherError } from '../../lib/errors.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VideoRequirements {
  maxFileSize: number;
  maxDuration: number;
  supportedFormats: string[];
  minResolution: string;
  recommendedResolution: string;
}

export class YouTubeValidator {
  private readonly maxTitleLength = 100;
  private readonly maxDescriptionLength = 5000;
  private readonly maxTags = 500;
  private readonly maxTagLength = 30;
  
  private readonly videoRequirements: VideoRequirements = {
    maxFileSize: 128 * 1024 * 1024 * 1024,
    maxDuration: 12 * 60 * 60,
    supportedFormats: ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.3gp', '.webm'],
    minResolution: '240p',
    recommendedResolution: '1080p'
  };

  validateTitle(title: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title || title.trim().length === 0) {
      errors.push('Title cannot be empty');
    }

    if (title.length > this.maxTitleLength) {
      errors.push(`Title exceeds maximum length of ${this.maxTitleLength} characters`);
    }

    if (title.length < 5) {
      warnings.push('Very short titles may affect discoverability');
    }

    if (!/[a-zA-Z0-9]/.test(title)) {
      warnings.push('Titles without alphanumeric characters may affect search visibility');
    }

    const forbiddenWords = ['sex', 'nude', 'xxx'];
    const titleLower = title.toLowerCase();
    if (forbiddenWords.some(word => titleLower.includes(word))) {
      warnings.push('Title may trigger content restrictions');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateDescription(description: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (description.length > this.maxDescriptionLength) {
      errors.push(`Description exceeds maximum length of ${this.maxDescriptionLength} characters`);
    }

    const urlCount = (description.match(/https?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 5) {
      warnings.push('Too many URLs may be flagged as spam');
    }

    if (description.length < 100) {
      warnings.push('Longer descriptions help with SEO and discovery');
    }

    const hashtagCount = (description.match(/#/g) || []).length;
    if (hashtagCount > 15) {
      warnings.push('YouTube recommends using no more than 15 hashtags');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateTags(tags: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tags.length > this.maxTags) {
      errors.push(`Maximum ${this.maxTags} tags allowed`);
    }

    const invalidTags = tags.filter(tag => tag.length > this.maxTagLength);
    if (invalidTags.length > 0) {
      errors.push(`Tags exceed maximum length of ${this.maxTagLength} characters: ${invalidTags.join(', ')}`);
    }

    if (tags.length < 5) {
      warnings.push('Using more tags helps with video discovery');
    }

    const totalCharacters = tags.join('').length;
    if (totalCharacters > 500) {
      warnings.push('Total tag characters should not exceed 500 for optimal performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateScheduledTime(scheduledAt: Date): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = Date.now();
    const scheduledTime = scheduledAt.getTime();
    const timeDiff = scheduledTime - now;

    if (scheduledTime <= now) {
      errors.push('Scheduled time must be in the future');
    }

    const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;
    if (timeDiff > twoYears) {
      errors.push('Videos cannot be scheduled more than 2 years in advance');
    }

    const fifteenMinutes = 15 * 60 * 1000;
    if (timeDiff < fifteenMinutes) {
      warnings.push('Scheduling less than 15 minutes in advance may cause processing delays');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateVideoFile(filePath: string, fileSize: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (!this.videoRequirements.supportedFormats.includes(extension)) {
      errors.push(`Unsupported video format: ${extension}`);
    }

    if (fileSize > this.videoRequirements.maxFileSize) {
      errors.push('Video file exceeds 128GB limit');
    }

    if (fileSize < 1024) {
      errors.push('Video file appears to be empty or corrupted');
    }

    if (fileSize > 10 * 1024 * 1024 * 1024) {
      warnings.push('Large video files may take significant time to upload');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validatePermissions(scopes: string[]): void {
    const requiredScopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube'
    ];

    const missingScopes = requiredScopes.filter(
      scope => !scopes.some(s => s.includes(scope))
    );

    if (missingScopes.length > 0) {
      throw new PublisherError(
        'MISSING_SCOPES',
        'Missing required YouTube API scopes',
        { required: requiredScopes, missing: missingScopes }
      );
    }
  }

  getVideoRequirements(): VideoRequirements {
    return { ...this.videoRequirements };
  }
}