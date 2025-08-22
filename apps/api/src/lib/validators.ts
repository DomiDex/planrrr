// Package: @repo/api
// Path: apps/api/src/lib/validators.ts
// Dependencies: none

// Platform character limits
const PLATFORM_LIMITS = {
  TWITTER: 280,
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  YOUTUBE: 5000
} as const;

// Platform-specific validation result
export interface ValidationResult {
  valid: boolean;
  characterCount: number;
  characterLimit: number;
  error?: string;
}

// Validate content for a specific platform
export function validatePlatformContent(
  content: string,
  platform: keyof typeof PLATFORM_LIMITS
): ValidationResult {
  const limit = PLATFORM_LIMITS[platform];
  const characterCount = content.length;
  
  if (characterCount === 0) {
    return {
      valid: false,
      characterCount,
      characterLimit: limit,
      error: 'Content cannot be empty'
    };
  }
  
  if (characterCount > limit) {
    return {
      valid: false,
      characterCount,
      characterLimit: limit,
      error: `Content exceeds ${platform} limit of ${limit} characters`
    };
  }
  
  // Platform-specific validations
  if (platform === 'INSTAGRAM') {
    const hashtagCount = (content.match(/#/g) || []).length;
    if (hashtagCount > 30) {
      return {
        valid: false,
        characterCount,
        characterLimit: limit,
        error: 'Instagram posts cannot have more than 30 hashtags'
      };
    }
  }
  
  return {
    valid: true,
    characterCount,
    characterLimit: limit
  };
}

// Validate all platforms
export function validateAllPlatforms(
  content: string,
  platforms: Array<keyof typeof PLATFORM_LIMITS>
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  
  for (const platform of platforms) {
    results.set(platform, validatePlatformContent(content, platform));
  }
  
  return results;
}

// Check if content is valid for all platforms
export function isValidForAllPlatforms(
  content: string,
  platforms: Array<keyof typeof PLATFORM_LIMITS>
): boolean {
  return platforms.every(platform => 
    validatePlatformContent(content, platform).valid
  );
}