// Package: @repo/worker
// Path: apps/worker/src/services/facebook/content-formatter.service.ts
// Dependencies: none

export interface FormattedContent {
  message: string;
  hashtags?: string[];
  mentions?: string[];
  link?: string;
}

export interface LinkAttachment {
  link: string;
  name?: string;
  caption?: string;
  description?: string;
}

export class FacebookContentFormatter {
  private readonly maxContentLength = 63206;
  private readonly maxHashtags = 30;

  formatContent(content: string): FormattedContent {
    const truncated = this.truncateContent(content);
    const hashtags = this.extractHashtags(truncated);
    const mentions = this.extractMentions(truncated);
    const link = this.extractFirstLink(truncated);

    return {
      message: truncated,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
      link
    };
  }

  truncateContent(content: string, maxLength?: number): string {
    const limit = maxLength || this.maxContentLength;
    
    if (content.length <= limit) {
      return content;
    }

    const truncated = content.substring(0, limit - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > limit * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  extractHashtags(content: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = content.match(hashtagRegex) || [];
    return matches.slice(0, this.maxHashtags);
  }

  extractMentions(content: string): string[] {
    const mentionRegex = /@[a-zA-Z0-9_]+/g;
    const matches = content.match(mentionRegex) || [];
    return [...new Set(matches)];
  }

  extractFirstLink(content: string): string | undefined {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = content.match(urlRegex);
    return matches?.[0];
  }

  createLinkAttachment(
    url: string,
    title?: string,
    description?: string
  ): LinkAttachment {
    return {
      link: url,
      name: title,
      caption: url.replace(/^https?:\/\//, '').split('/')[0],
      description: description ? this.truncateContent(description, 200) : undefined
    };
  }

  processHashtags(content: string): string {
    const hashtags = this.extractHashtags(content);
    
    if (hashtags.length > this.maxHashtags) {
      const limitedHashtags = hashtags.slice(0, this.maxHashtags);
      const contentWithoutHashtags = content.replace(/#[a-zA-Z0-9_]+/g, '');
      return contentWithoutHashtags.trim() + '\n\n' + limitedHashtags.join(' ');
    }
    
    return content;
  }

  processMentions(content: string, _pageId: string): string {
    const mentionPattern = /@(\w+)/g;
    return content.replace(mentionPattern, (match, username) => {
      if (username.toLowerCase() === 'everyone') {
        return '@[everyone]';
      }
      return match;
    });
  }
}