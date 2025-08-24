// Package: @repo/worker
// Path: apps/worker/src/services/youtube/content-processor.service.ts
// Dependencies: none

export interface ProcessedContent {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
}

export interface VideoDefaults {
  categoryId: string;
  defaultLanguage: string;
  defaultAudioLanguage: string;
}

export class YouTubeContentProcessor {
  private readonly maxTitleLength = 100;
  private readonly maxDescriptionLength = 5000;
  private readonly maxTags = 500;
  private readonly maxTagLength = 30;

  processContent(content: string, title?: string): ProcessedContent {
    const processedTitle = this.generateTitle(content, title);
    const processedDescription = this.formatDescription(content);
    const tags = this.extractTags(content);
    const hashtags = this.extractHashtags(content);

    return {
      title: processedTitle,
      description: processedDescription,
      tags: tags.slice(0, this.maxTags),
      hashtags: hashtags.slice(0, 15)
    };
  }

  generateTitle(content: string, providedTitle?: string): string {
    if (providedTitle) {
      return this.truncateTitle(providedTitle);
    }

    const firstLine = content.split('\n')[0];
    const cleanTitle = (firstLine || '')
      .replace(/#\w+/g, '')
      .replace(/@\w+/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    if (cleanTitle.length > 0) {
      return this.truncateTitle(cleanTitle);
    }

    const words = content.split(/\s+/).slice(0, 10).join(' ');
    return this.truncateTitle(words);
  }

  truncateTitle(title: string): string {
    if (title.length <= this.maxTitleLength) {
      return title;
    }

    const truncated = title.substring(0, this.maxTitleLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > this.maxTitleLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  formatDescription(content: string): string {
    let description = content;

    const hashtags = this.extractHashtags(content);
    if (hashtags.length > 0) {
      const hashtagSection = '\n\n' + hashtags.slice(0, 15).join(' ');
      if (description.length + hashtagSection.length <= this.maxDescriptionLength) {
        description += hashtagSection;
      }
    }

    const timestamps = this.generateTimestamps(content);
    if (timestamps.length > 0) {
      const timestampSection = '\n\nTimestamps:\n' + timestamps.join('\n');
      if (description.length + timestampSection.length <= this.maxDescriptionLength) {
        description += timestampSection;
      }
    }

    if (description.length > this.maxDescriptionLength) {
      description = description.substring(0, this.maxDescriptionLength - 3) + '...';
    }

    return description;
  }

  extractTags(content: string): string[] {
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length <= this.maxTagLength);

    const hashtags = this.extractHashtags(content)
      .map(tag => tag.substring(1).toLowerCase());

    const keywords = this.extractKeywords(content);

    const allTags = [...new Set([...hashtags, ...keywords, ...words])];
    return allTags.slice(0, this.maxTags);
  }

  extractHashtags(content: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = content.match(hashtagRegex) || [];
    return [...new Set(matches)];
  }

  extractKeywords(content: string): string[] {
    const commonKeywords = [
      'tutorial', 'howto', 'guide', 'review', 'vlog',
      'diy', 'tips', 'tricks', 'best', 'top'
    ];

    const contentLower = content.toLowerCase();
    return commonKeywords.filter(keyword => contentLower.includes(keyword));
  }

  generateTimestamps(content: string): string[] {
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)/g;
    const timestamps: string[] = [];
    let match;

    while ((match = timestampRegex.exec(content)) !== null) {
      timestamps.push(`${match[1]} - ${match[2]?.trim() || ''}`);
    }

    return timestamps;
  }

  addChapters(description: string, chapters: Array<{ time: string; title: string }>): string {
    if (chapters.length === 0) return description;

    const chapterSection = 'Chapters:\n' + chapters
      .map(ch => `${ch.time} ${ch.title}`)
      .join('\n');

    const totalLength = description.length + chapterSection.length + 4;
    if (totalLength <= this.maxDescriptionLength) {
      return description + '\n\n' + chapterSection;
    }

    const availableSpace = this.maxDescriptionLength - chapterSection.length - 7;
    return description.substring(0, availableSpace) + '...\n\n' + chapterSection;
  }

  getVideoDefaults(): VideoDefaults {
    return {
      categoryId: '22',
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en'
    };
  }
}