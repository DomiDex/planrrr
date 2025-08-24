// Package: @repo/worker
// Path: apps/worker/src/services/linkedin/validator.service.ts
// Dependencies: none

import type { MediaRequirements } from '../../types/publisher.js';

export interface LinkedInValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface LinkedInMediaValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

export class LinkedInValidator {
  private readonly contentLimit = 3000;
  private readonly articleTitleLimit = 200;
  private readonly articleDescriptionLimit = 300;
  private readonly maxHashtags = 30;
  private readonly recommendedHashtags = { min: 3, max: 5 };
  private readonly maxImageCount = 20;
  private readonly maxVideoCount = 1;

  validateContent(content: string): LinkedInValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (content.length > this.contentLimit) {
      errors.push(
        `Content exceeds LinkedIn's ${this.contentLimit} character limit (current: ${content.length})`
      );
    }

    if (content.length < 50) {
      warnings.push('Very short posts may have reduced engagement on LinkedIn');
    }

    const hashtags = this.extractHashtags(content);
    if (hashtags.length > this.maxHashtags) {
      errors.push(
        `Too many hashtags (${hashtags.length}/${this.maxHashtags} maximum)`
      );
    } else if (hashtags.length > this.recommendedHashtags.max) {
      warnings.push(
        `Consider using ${this.recommendedHashtags.min}-${this.recommendedHashtags.max} hashtags for optimal engagement`
      );
    } else if (hashtags.length === 0) {
      suggestions.push('Adding 3-5 relevant hashtags can increase post visibility');
    }

    const urls = this.extractUrls(content);
    if (urls.length > 3) {
      warnings.push('Multiple URLs detected. LinkedIn may only show preview for the first link');
    }

    if (!this.hasEngagementElement(content)) {
      suggestions.push('Consider adding a question or call-to-action to encourage engagement');
    }

    const mentions = this.extractMentions(content);
    if (mentions.length > 10) {
      warnings.push(`High number of mentions (${mentions.length}) may be seen as spammy`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  validateArticle(
    title: string,
    description: string,
    url: string
  ): LinkedInValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!url || !this.isValidUrl(url)) {
      errors.push('Invalid article URL');
    }

    if (title.length > this.articleTitleLimit) {
      errors.push(
        `Article title exceeds ${this.articleTitleLimit} character limit`
      );
    }

    if (!title) {
      errors.push('Article title is required');
    }

    if (description.length > this.articleDescriptionLimit) {
      warnings.push(
        `Article description exceeds recommended ${this.articleDescriptionLimit} character limit`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateImage(url: string): LinkedInMediaValidation {
    const extension = this.getFileExtension(url);
    
    if (!['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return {
        valid: false,
        error: 'LinkedIn supports JPG, PNG, and GIF images'
      };
    }

    return { valid: true };
  }

  validateVideo(url: string): LinkedInMediaValidation {
    const extension = this.getFileExtension(url);
    
    if (!['mp4', 'mov', 'avi'].includes(extension)) {
      return {
        valid: false,
        error: 'LinkedIn supports MP4, MOV, and AVI video formats'
      };
    }

    return { valid: true };
  }

  validateDocument(url: string): LinkedInMediaValidation {
    const extension = this.getFileExtension(url);
    
    if (!['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
      return {
        valid: false,
        error: 'LinkedIn supports PDF, Word, and PowerPoint documents'
      };
    }

    return { valid: true };
  }

  validateMediaCount(
    mediaUrls: string[],
    mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  ): LinkedInValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (mediaType === 'IMAGE' && mediaUrls.length > this.maxImageCount) {
      errors.push(
        `Too many images (${mediaUrls.length}/${this.maxImageCount} maximum)`
      );
    }

    if (mediaType === 'VIDEO' && mediaUrls.length > this.maxVideoCount) {
      errors.push('LinkedIn only supports one video per post');
    }

    if (mediaType === 'IMAGE' && mediaUrls.length > 9) {
      warnings.push('Posts with more than 9 images may have reduced engagement');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validatePoll(
    question: string,
    options: string[]
  ): LinkedInValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!question || question.length === 0) {
      errors.push('Poll question is required');
    }

    if (question.length > 140) {
      errors.push('Poll question exceeds 140 character limit');
    }

    if (options.length < 2) {
      errors.push('Polls must have at least 2 options');
    }

    if (options.length > 4) {
      errors.push('Polls cannot have more than 4 options');
    }

    for (const [index, option] of options.entries()) {
      if (option.length > 30) {
        errors.push(`Poll option ${index + 1} exceeds 30 character limit`);
      }
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
        minWidth: 552,
        minHeight: 289,
        maxWidth: 7680,
        maxHeight: 4320,
        aspectRatios: ['1.91:1', '1:1', '4:5'],
        maxSizeMB: 10,
        formats: ['jpg', 'jpeg', 'png', 'gif']
      },
      videos: {
        minDuration: 3,
        maxDuration: 600,
        maxSizeMB: 5120,
        minWidth: 256,
        minHeight: 144,
        maxWidth: 4096,
        maxHeight: 2304,
        aspectRatios: ['16:9', '1:1', '4:5', '9:16'],
        formats: ['mp4', 'mov', 'avi']
      },
      documents: {
        maxSizeMB: 100,
        formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
      },
      maxCount: 20
    };
  }

  private extractHashtags(content: string): string[] {
    const regex = /#[\w]+/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private extractMentions(content: string): string[] {
    const regex = /@[\w\s]+(?:\([^)]+\))?/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  }

  private extractUrls(content: string): string[] {
    const regex = /https?:\/\/[^\s]+/g;
    const matches = content.match(regex) || [];
    return matches;
  }

  private getFileExtension(url: string): string {
    const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
    return match?.[1] ?? '';
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private hasEngagementElement(content: string): boolean {
    const engagementPatterns = [
      /\?$/m,
      /what do you think/i,
      /share your/i,
      /let me know/i,
      /thoughts\?/i,
      /agree or disagree/i,
      /your experience/i,
      /comment below/i,
      /would love to hear/i,
      /your perspective/i
    ];

    return engagementPatterns.some(pattern => pattern.test(content));
  }

  isWithinApiLimits(requestsToday: number): boolean {
    return requestsToday < 1000;
  }

  validateAccountType(accountType?: string): LinkedInValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!accountType) {
      errors.push('Account type not specified');
    } else if (!['PERSONAL', 'ORGANIZATION'].includes(accountType.toUpperCase())) {
      errors.push('Invalid LinkedIn account type');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}