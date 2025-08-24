// Package: @repo/worker
// Path: apps/worker/src/services/x/content-formatter.service.ts
// Dependencies: none

export interface FormattedTweet {
  text: string;
  characterCount: number;
  weightedLength: number;
  hasMedia: boolean;
  urls: string[];
  mentions: string[];
  hashtags: string[];
}

export interface ThreadOptions {
  maxLength?: number;
  threadIndicator?: boolean;
  preserveWords?: boolean;
  numberThreads?: boolean;
}

export class XContentFormatter {
  private readonly tweetMaxLength = 280;
  private readonly urlLength = 23;
  private readonly mediaUrlLength = 24;
  private readonly reservedMediaLength = 24;

  formatContent(content: string, hasMedia = false): FormattedTweet {
    let formattedText = content;
    
    formattedText = this.normalizeWhitespace(formattedText);
    formattedText = this.formatMentions(formattedText);
    formattedText = this.formatHashtags(formattedText);
    
    const urls = this.extractUrls(formattedText);
    const mentions = this.extractMentions(formattedText);
    const hashtags = this.extractHashtags(formattedText);
    
    const characterCount = this.calculateLength(formattedText);
    const weightedLength = this.calculateWeightedLength(
      formattedText,
      urls.length,
      hasMedia
    );

    return {
      text: formattedText.trim(),
      characterCount,
      weightedLength,
      hasMedia,
      urls,
      mentions,
      hashtags
    };
  }

  splitIntoThread(
    content: string,
    options: ThreadOptions = {}
  ): string[] {
    const {
      maxLength = 275,
      threadIndicator = true,
      preserveWords = true,
      numberThreads = false
    } = options;

    if (this.calculateWeightedLength(content, 0, false) <= this.tweetMaxLength) {
      return [content];
    }

    const tweets: string[] = [];
    const sentences = this.splitIntoSentences(content);
    let currentTweet = '';
    let tweetNumber = 1;

    for (const sentence of sentences) {
      const testTweet = currentTweet 
        ? `${currentTweet} ${sentence}` 
        : sentence;
      
      let testLength = this.calculateWeightedLength(testTweet, 0, false);
      
      if (threadIndicator) {
        testLength += 5;
      }
      
      if (numberThreads) {
        testLength += 7;
      }

      if (testLength <= maxLength) {
        currentTweet = testTweet;
      } else {
        if (currentTweet) {
          tweets.push(this.addThreadIndicator(
            currentTweet,
            tweetNumber,
            threadIndicator,
            numberThreads
          ));
          tweetNumber++;
        }
        
        if (this.calculateWeightedLength(sentence, 0, false) > maxLength) {
          const splitSentence = this.splitLongSentence(
            sentence,
            maxLength,
            preserveWords
          );
          
          for (const part of splitSentence) {
            tweets.push(this.addThreadIndicator(
              part,
              tweetNumber,
              threadIndicator,
              numberThreads
            ));
            tweetNumber++;
          }
          currentTweet = '';
        } else {
          currentTweet = sentence;
        }
      }
    }

    if (currentTweet) {
      tweets.push(this.addThreadIndicator(
        currentTweet,
        tweetNumber,
        threadIndicator,
        numberThreads,
        true
      ));
    }

    return tweets;
  }

  calculateLength(text: string): number {
    const normalized = Array.from(text);
    return normalized.length;
  }

  calculateWeightedLength(
    text: string,
    urlCount: number,
    hasMedia: boolean
  ): number {
    let length = this.calculateLength(text);
    
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
      const urlLength = this.calculateLength(url);
      length = length - urlLength + this.urlLength;
    }
    
    if (hasMedia) {
      length += this.reservedMediaLength;
    }

    return length;
  }

  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private formatMentions(text: string): string {
    return text.replace(/([^\s@])@/g, '$1 @');
  }

  private formatHashtags(text: string): string {
    return text.replace(/([^\s#])#/g, '$1 #');
  }

  private extractUrls(text: string): string[] {
    const regex = /https?:\/\/[^\s]+/g;
    const matches = text.match(regex) || [];
    return matches;
  }

  private extractMentions(text: string): string[] {
    const regex = /@[\w]+/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)];
  }

  private extractHashtags(text: string): string[] {
    const regex = /#[\w]+/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)];
  }

  private splitIntoSentences(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  private splitLongSentence(
    sentence: string,
    maxLength: number,
    preserveWords: boolean
  ): string[] {
    const parts: string[] = [];
    
    if (!preserveWords) {
      for (let i = 0; i < sentence.length; i += maxLength) {
        parts.push(sentence.substring(i, i + maxLength).trim());
      }
      return parts;
    }

    const words = sentence.split(' ');
    let currentPart = '';

    for (const word of words) {
      const testPart = currentPart ? `${currentPart} ${word}` : word;
      
      if (this.calculateWeightedLength(testPart, 0, false) <= maxLength) {
        currentPart = testPart;
      } else {
        if (currentPart) {
          parts.push(currentPart);
        }
        currentPart = word;
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    return parts;
  }

  private addThreadIndicator(
    text: string,
    tweetNumber: number,
    threadIndicator: boolean,
    numberThreads: boolean,
    isLast = false
  ): string {
    let formatted = text;

    if (numberThreads) {
      formatted = `${tweetNumber}/ ${formatted}`;
    }

    if (threadIndicator && !isLast) {
      formatted = `${formatted} 🧵`;
    }

    return formatted;
  }

  removeEmojis(text: string): string {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return text.replace(emojiRegex, '');
  }

  truncateToLength(text: string, maxLength: number): string {
    if (this.calculateWeightedLength(text, 0, false) <= maxLength) {
      return text;
    }

    let truncated = text;
    while (this.calculateWeightedLength(truncated, 0, false) > maxLength - 3) {
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace === -1) {
        truncated = truncated.substring(0, truncated.length - 1);
      } else {
        truncated = truncated.substring(0, lastSpace);
      }
    }

    return `${truncated}...`;
  }
}