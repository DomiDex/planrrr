// Package: @repo/worker
// Path: apps/worker/src/services/instagram/validator.service.ts
// Dependencies: none

import type { MediaRequirements } from '../../types/publisher.js';

export interface InstagramValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InstagramMediaValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

export class InstagramValidator {
  private readonly captionLimit = 2200;
  private readonly hashtagLimit = 30;
  private readonly mentionWarningThreshold = 20;
  private readonly carouselMinItems = 2;
  private readonly carouselMaxItems = 10;

  validateContent(content: string): InstagramValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (content.length > this.captionLimit) {
      errors.push(
        `Caption exceeds Instagram's ${this.captionLimit} character limit (current: ${content.length})`
      );
    }

    const hashtags = this.extractHashtags(content);
    if (hashtags.length > this.hashtagLimit) {
      errors.push(
        `Too many hashtags (${hashtags.length}/${this.hashtagLimit} maximum)`
      );
    } else if (hashtags.length > 10) {
      warnings.push(
        `Consider using fewer hashtags for better engagement (current: ${hashtags.length})`
      );
    }

    const mentions = this.extractMentions(content);
    if (mentions.length > this.mentionWarningThreshold) {
      warnings.push(
        `High number of mentions (${mentions.length}). Instagram may flag as spam.`
      );
    }

    const bannedHashtags = this.checkBannedHashtags(hashtags);
    if (bannedHashtags.length > 0) {
      warnings.push(
        `Potentially banned/restricted hashtags detected: ${bannedHashtags.join(', ')}`
      );
    }

    if (content.includes('http://')) {
      warnings.push('Links in captions are not clickable. Consider using "Link in Bio"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateImage(url: string): InstagramMediaValidation {
    const extension = this.getFileExtension(url);
    
    if (!['jpg', 'jpeg', 'png'].includes(extension)) {
      return {
        valid: false,
        error: 'Instagram only supports JPEG and PNG images'
      };
    }

    if (extension === 'png') {
      return {
        valid: true,
        warning: 'PNG images will be converted to JPEG by Instagram'
      };
    }

    return { valid: true };
  }

  validateVideo(url: string): InstagramMediaValidation {
    const extension = this.getFileExtension(url);
    
    if (!['mp4', 'mov'].includes(extension)) {
      return {
        valid: false,
        error: 'Instagram only supports MP4 and MOV video formats'
      };
    }

    return { valid: true };
  }

  validateCarousel(mediaUrls: string[]): InstagramValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (mediaUrls.length < this.carouselMinItems) {
      errors.push(
        `Carousel must have at least ${this.carouselMinItems} items`
      );
    }

    if (mediaUrls.length > this.carouselMaxItems) {
      errors.push(
        `Carousel cannot exceed ${this.carouselMaxItems} items`
      );
    }

    const hasVideo = mediaUrls.some(url => 
      ['mp4', 'mov'].includes(this.getFileExtension(url))
    );

    if (hasVideo && mediaUrls.length > 1) {
      const videoCount = mediaUrls.filter(url => 
        ['mp4', 'mov'].includes(this.getFileExtension(url))
      ).length;

      if (videoCount > 1) {
        warnings.push('Multiple videos in carousel may reduce reach');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateBusinessAccount(accountType?: string): InstagramValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!accountType) {
      errors.push('Account type not specified');
    } else if (!['BUSINESS', 'CREATOR'].includes(accountType.toUpperCase())) {
      errors.push(
        'Instagram API requires a Business or Creator account for publishing'
      );
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
        minWidth: 320,
        minHeight: 320,
        maxWidth: 1080,
        maxHeight: 1350,
        aspectRatios: ['1:1', '4:5', '1.91:1'],
        maxSizeMB: 8,
        formats: ['jpg', 'jpeg', 'png']
      },
      videos: {
        minDuration: 3,
        maxDuration: 60,
        maxSizeMB: 100,
        minWidth: 320,
        minHeight: 320,
        maxWidth: 1080,
        maxHeight: 1920,
        aspectRatios: ['1:1', '4:5', '9:16'],
        formats: ['mp4', 'mov']
      },
      maxCount: 10
    };
  }

  private extractHashtags(content: string): string[] {
    const regex = /#[\w\u0080-\uFFFF]+/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private extractMentions(content: string): string[] {
    const regex = /@[\w.]+/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private getFileExtension(url: string): string {
    const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
    return match?.[1] ?? '';
  }

  private checkBannedHashtags(hashtags: string[]): string[] {
    const commonBannedTags = [
      '#adulting',
      '#alone',
      '#brain',
      '#dm',
      '#edm',
      '#goddess',
      '#hardworkpaysoff',
      '#kansas',
      '#lean',
      '#master',
      '#nasty',
      '#newyears',
      '#overnight',
      '#petite',
      '#pornfood',
      '#saltwater',
      '#shit',
      '#shower',
      '#single',
      '#singlelife',
      '#snapchat',
      '#stranger',
      '#sunbathing',
      '#tag4like',
      '#teens',
      '#thought',
      '#thighs',
      '#valentinesday',
      '#woman',
      '#workflow'
    ];

    return hashtags.filter(tag => 
      commonBannedTags.includes(tag.toLowerCase())
    );
  }

  isWithinPublishingLimit(postsToday: number): boolean {
    return postsToday < 25;
  }

  validateAspectRatio(width: number, height: number, mediaType: 'IMAGE' | 'VIDEO'): boolean {
    const ratio = width / height;
    
    if (mediaType === 'IMAGE') {
      const validRatios = [
        { min: 0.99, max: 1.01 },
        { min: 0.79, max: 0.81 },
        { min: 1.90, max: 1.92 }
      ];
      
      return validRatios.some(r => ratio >= r.min && ratio <= r.max);
    }
    
    const validVideoRatios = [
      { min: 0.99, max: 1.01 },
      { min: 0.79, max: 0.81 },
      { min: 0.55, max: 0.57 }
    ];
    
    return validVideoRatios.some(r => ratio >= r.min && ratio <= r.max);
  }
}