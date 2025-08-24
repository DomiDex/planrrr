// Package: @repo/worker
// Path: apps/worker/src/services/facebook/validator.service.ts
// Dependencies: none

import { PublisherError } from '../../lib/errors.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MediaRequirements {
  maxImageSize: number;
  maxVideoSize: number;
  maxImages: number;
  supportedImageFormats: string[];
  supportedVideoFormats: string[];
}

export class FacebookValidator {
  private readonly maxContentLength = 63206;
  private readonly minScheduleTime = 10 * 60 * 1000;
  private readonly maxScheduleTime = 30 * 24 * 60 * 60 * 1000;
  
  private readonly mediaRequirements: MediaRequirements = {
    maxImageSize: 10 * 1024 * 1024,
    maxVideoSize: 1024 * 1024 * 1024,
    maxImages: 10,
    supportedImageFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    supportedVideoFormats: ['.mp4', '.mov', '.avi']
  };

  validateContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (content.length > this.maxContentLength) {
      errors.push(`Content exceeds maximum length of ${this.maxContentLength} characters`);
    }

    if (content.length > 5000) {
      warnings.push('Content is very long and may not display fully on all devices');
    }

    const hashtagCount = (content.match(/#/g) || []).length;
    if (hashtagCount > 30) {
      warnings.push('Too many hashtags may reduce reach');
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

    if (timeDiff < this.minScheduleTime) {
      errors.push('Posts must be scheduled at least 10 minutes in advance');
    }

    if (timeDiff > this.maxScheduleTime) {
      errors.push('Posts cannot be scheduled more than 30 days in advance');
    }

    if (timeDiff < 60 * 60 * 1000) {
      warnings.push('Scheduling less than 1 hour in advance may affect delivery');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateMediaFiles(filePaths: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (filePaths.length > this.mediaRequirements.maxImages) {
      errors.push(`Maximum ${this.mediaRequirements.maxImages} images allowed`);
    }

    for (const path of filePaths) {
      const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
      const isImage = this.mediaRequirements.supportedImageFormats.includes(extension);
      const isVideo = this.mediaRequirements.supportedVideoFormats.includes(extension);

      if (!isImage && !isVideo) {
        errors.push(`Unsupported file format: ${extension}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validatePermissions(permissions: string[]): void {
    const requiredPermissions = ['pages_manage_posts', 'pages_read_engagement'];
    const missingPermissions = requiredPermissions.filter(
      perm => !permissions.includes(perm)
    );

    if (missingPermissions.length > 0) {
      throw new PublisherError(
        'MISSING_PERMISSIONS',
        'Missing required Facebook permissions',
        { required: requiredPermissions, missing: missingPermissions }
      );
    }
  }

  getMediaRequirements(): MediaRequirements {
    return { ...this.mediaRequirements };
  }
}