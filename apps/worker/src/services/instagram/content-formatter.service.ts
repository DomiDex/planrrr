// Package: @repo/worker
// Path: apps/worker/src/services/instagram/content-formatter.service.ts
// Dependencies: none

export interface FormattedInstagramContent {
  caption: string;
  hashtags: string[];
  mentions: string[];
  hasLink: boolean;
  firstLink?: string;
}

export class InstagramContentFormatter {
  private readonly maxCaptionLength = 2200;
  private readonly maxHashtags = 30;
  private readonly maxMentions = 20;

  formatContent(content: string): FormattedInstagramContent {
    let formattedCaption = content;

    formattedCaption = this.ensureHashtagSpacing(formattedCaption);
    formattedCaption = this.ensureMentionSpacing(formattedCaption);
    formattedCaption = this.convertLineBreaks(formattedCaption);
    formattedCaption = this.truncateIfNeeded(formattedCaption);

    const hashtags = this.extractHashtags(formattedCaption);
    const mentions = this.extractMentions(formattedCaption);
    const links = this.extractLinks(formattedCaption);

    return {
      caption: formattedCaption.trim(),
      hashtags,
      mentions,
      hasLink: links.length > 0,
      firstLink: links[0]
    };
  }

  formatHashtags(hashtags: string[]): string {
    const validHashtags = hashtags
      .map(tag => this.sanitizeHashtag(tag))
      .filter(tag => tag.length > 1)
      .slice(0, this.maxHashtags);

    return validHashtags.join(' ');
  }

  formatMentions(mentions: string[]): string {
    const validMentions = mentions
      .map(mention => this.sanitizeMention(mention))
      .filter(mention => mention.length > 1)
      .slice(0, this.maxMentions);

    return validMentions.join(' ');
  }

  appendHashtagsToCaption(caption: string, hashtags: string[]): string {
    const hashtagString = this.formatHashtags(hashtags);
    
    if (!hashtagString) {
      return caption;
    }

    const separator = caption.includes('\n\n') ? '\n\n' : '\n\n';
    const combined = `${caption}${separator}${hashtagString}`;

    if (combined.length > this.maxCaptionLength) {
      return this.truncateWithHashtags(caption, hashtagString);
    }

    return combined;
  }

  private ensureHashtagSpacing(content: string): string {
    return content.replace(/([^\s#])#/g, '$1 #');
  }

  private ensureMentionSpacing(content: string): string {
    return content.replace(/([^\s@])@/g, '$1 @');
  }

  private convertLineBreaks(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  private truncateIfNeeded(content: string): string {
    if (content.length <= this.maxCaptionLength) {
      return content;
    }

    const truncated = content.substring(0, this.maxCaptionLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > this.maxCaptionLength - 50) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  private truncateWithHashtags(caption: string, hashtagString: string): string {
    const separator = '\n\n';
    const overhead = separator.length + hashtagString.length + 3;
    const maxCaptionPart = this.maxCaptionLength - overhead;

    if (maxCaptionPart < 100) {
      return caption.substring(0, this.maxCaptionLength - 3) + '...';
    }

    const truncatedCaption = caption.substring(0, maxCaptionPart);
    const lastSpace = truncatedCaption.lastIndexOf(' ');
    
    const finalCaption = lastSpace > maxCaptionPart - 50
      ? truncatedCaption.substring(0, lastSpace) + '...'
      : truncatedCaption + '...';

    return `${finalCaption}${separator}${hashtagString}`;
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

  private extractLinks(content: string): string[] {
    const regex = /https?:\/\/[^\s]+/g;
    const matches = content.match(regex) || [];
    return matches;
  }

  private sanitizeHashtag(hashtag: string): string {
    let sanitized = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    sanitized = sanitized.replace(/[^\w#\u0080-\uFFFF]/g, '');
    sanitized = sanitized.replace(/^#+/, '#');
    
    return sanitized;
  }

  private sanitizeMention(mention: string): string {
    let sanitized = mention.startsWith('@') ? mention : `@${mention}`;
    sanitized = sanitized.replace(/[^\w@.]/g, '');
    sanitized = sanitized.replace(/^@+/, '@');
    sanitized = sanitized.replace(/\.+$/, '');
    
    return sanitized;
  }

  removeEmojis(content: string): string {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return content.replace(emojiRegex, '');
  }

  addLineBreaksForReadability(content: string, maxLineLength = 125): string {
    const lines = content.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      if (line.length <= maxLineLength) {
        formattedLines.push(line);
        continue;
      }

      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).length > maxLineLength) {
          if (currentLine) {
            formattedLines.push(currentLine);
            currentLine = word;
          } else {
            formattedLines.push(word);
          }
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }

      if (currentLine) {
        formattedLines.push(currentLine);
      }
    }

    return formattedLines.join('\n');
  }
}