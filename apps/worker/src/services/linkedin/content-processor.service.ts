// Package: @repo/worker
// Path: apps/worker/src/services/linkedin/content-processor.service.ts
// Dependencies: none

export interface ProcessedLinkedInContent {
  text: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  articleData?: {
    title: string;
    description: string;
    url: string;
  };
}

export interface LinkedInPostType {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'ARTICLE' | 'DOCUMENT' | 'POLL';
  mediaCount?: number;
}

export class LinkedInContentProcessor {
  private readonly maxTextLength = 3000;
  private readonly maxHashtags = 30;
  private readonly recommendedHashtags = 5;

  processContent(
    content: string,
    articleUrl?: string,
    articleTitle?: string,
    articleDescription?: string
  ): ProcessedLinkedInContent {
    let processedText = content;

    processedText = this.formatForLinkedIn(processedText);
    processedText = this.optimizeLineBreaks(processedText);
    processedText = this.ensureHashtagFormatting(processedText);
    
    if (processedText.length > this.maxTextLength) {
      processedText = this.truncateContent(processedText);
    }

    const hashtags = this.extractHashtags(processedText);
    const mentions = this.extractMentions(processedText);
    const urls = this.extractUrls(processedText);

    const result: ProcessedLinkedInContent = {
      text: processedText,
      hashtags,
      mentions,
      urls
    };

    if (articleUrl && articleTitle) {
      result.articleData = {
        title: this.truncateTitle(articleTitle),
        description: this.truncateDescription(articleDescription || ''),
        url: articleUrl
      };
    }

    return result;
  }

  determinePostType(
    content: string,
    mediaUrls?: string[],
    articleUrl?: string,
    pollOptions?: string[]
  ): LinkedInPostType {
    if (pollOptions && pollOptions.length > 0) {
      return { type: 'POLL' };
    }

    if (articleUrl) {
      return { type: 'ARTICLE' };
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      return { type: 'TEXT' };
    }

    const firstMedia = mediaUrls[0];
    if (!firstMedia) {
      return { type: 'TEXT' };
    }
    
    if (this.isVideoFile(firstMedia)) {
      return { type: 'VIDEO', mediaCount: 1 };
    }

    if (this.isDocumentFile(firstMedia)) {
      return { type: 'DOCUMENT', mediaCount: 1 };
    }

    return { type: 'IMAGE', mediaCount: mediaUrls.length };
  }

  formatForProfessionalTone(content: string): string {
    let professional = content;

    const informalPhrases: Record<string, string> = {
      'hey guys': 'Hello everyone',
      'you guys': 'everyone',
      'gonna': 'going to',
      'wanna': 'want to',
      'gotta': 'have to',
      'kinda': 'kind of',
      'sorta': 'sort of',
      'dunno': 'don\'t know',
      'lemme': 'let me',
      'gimme': 'give me',
      'y\'all': 'everyone',
      'ain\'t': 'isn\'t',
      'sup': 'Hello',
      'thx': 'thank you',
      'plz': 'please'
    };

    for (const [informal, formal] of Object.entries(informalPhrases)) {
      const regex = new RegExp(`\\b${informal}\\b`, 'gi');
      professional = professional.replace(regex, formal);
    }

    return professional;
  }

  optimizeHashtagPlacement(content: string, hashtags: string[]): string {
    const existingHashtags = this.extractHashtags(content);
    const contentWithoutHashtags = this.removeHashtags(content);
    
    const uniqueHashtags = [...new Set([...existingHashtags, ...hashtags])]
      .slice(0, this.recommendedHashtags);
    
    const hashtagBlock = uniqueHashtags.join(' ');
    
    const separator = contentWithoutHashtags.trim().endsWith('.') 
      ? '\n\n' 
      : '.\n\n';
    
    return `${contentWithoutHashtags.trim()}${separator}${hashtagBlock}`;
  }

  createEngagementPrompt(content: string): string {
    const prompts = [
      'What are your thoughts?',
      'I\'d love to hear your perspective.',
      'Share your experiences in the comments.',
      'What has been your experience?',
      'Let me know your thoughts below.',
      'How do you approach this?',
      'What would you add?',
      'Agree or disagree? Let me know why.',
      'What\'s your take on this?',
      'Have you encountered similar situations?'
    ];

    if (content.includes('?')) {
      return content;
    }

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    return `${content}\n\n${randomPrompt}`;
  }

  private formatForLinkedIn(content: string): string {
    let formatted = content;

    formatted = formatted.replace(/\r\n/g, '\n');
    formatted = formatted.replace(/\t/g, '  ');
    
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
    formatted = formatted.replace(/__(.*?)__/g, '$1');
    formatted = formatted.replace(/\*(.*?)\*/g, '$1');
    formatted = formatted.replace(/_(.*?)_/g, '$1');
    
    return formatted;
  }

  private optimizeLineBreaks(content: string): string {
    let optimized = content.replace(/\n{4,}/g, '\n\n\n');
    
    optimized = optimized.replace(/([.!?])\n([A-Z])/g, '$1\n\n$2');
    
    return optimized;
  }

  private ensureHashtagFormatting(content: string): string {
    return content.replace(/([^\s#])#/g, '$1 #');
  }

  private truncateContent(content: string): string {
    if (content.length <= this.maxTextLength) {
      return content;
    }

    const truncated = content.substring(0, this.maxTextLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > this.maxTextLength - 100) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  private truncateTitle(title: string, maxLength = 200): string {
    if (title.length <= maxLength) {
      return title;
    }
    
    return title.substring(0, maxLength - 3) + '...';
  }

  private truncateDescription(description: string, maxLength = 300): string {
    if (description.length <= maxLength) {
      return description;
    }
    
    const truncated = description.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength - 50) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
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

  private removeHashtags(content: string): string {
    return content.replace(/#[\w]+/g, '').trim();
  }

  private isVideoFile(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
    return videoExtensions.some(ext => url.includes(ext));
  }

  private isDocumentFile(url: string): boolean {
    const docExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    return docExtensions.some(ext => url.includes(ext));
  }
}