import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface EnvOptions<T extends z.ZodSchema> {
  schema: T;
  skipValidation?: boolean;
  onValidationError?: (error: z.ZodError) => void;
  envPath?: string;
}

export function createEnv<T extends z.ZodSchema>({
  schema,
  skipValidation = false,
  onValidationError,
  envPath,
}: EnvOptions<T>): z.infer<T> {
  // Load environment variables from .env files
  const envFiles = [
    envPath,
    `.env.${process.env.NODE_ENV}.local`,
    `.env.${process.env.NODE_ENV}`,
    '.env.local',
    '.env',
  ].filter(Boolean);

  for (const file of envFiles) {
    if (file && fs.existsSync(file)) {
      dotenv.config({ path: file });
    }
  }

  if (skipValidation) {
    return process.env as any;
  }

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    if (onValidationError) {
      onValidationError(parsed.error);
    } else {
      console.error('❌ Invalid environment variables:');
      console.error(parsed.error.flatten());
      throw new Error('Invalid environment variables');
    }
  }

  return parsed.data;
}

export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64');
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function validateUrl(url: string, requireHttps: boolean = false): boolean {
  try {
    const parsed = new URL(url);
    if (requireHttps && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateDatabaseUrl(url: string, requireSSL: boolean = true): boolean {
  if (!validateUrl(url)) {
    return false;
  }
  
  if (requireSSL && !url.includes('sslmode=')) {
    return false;
  }
  
  return true;
}

export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (secret.length <= visibleChars * 2) {
    return '*'.repeat(secret.length);
  }
  
  const start = secret.slice(0, visibleChars);
  const end = secret.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(8, secret.length - visibleChars * 2));
  
  return `${start}${masked}${end}`;
}

export function getRequiredEnvVars(schema: z.ZodSchema): string[] {
  const shape = (schema as any)._def.shape();
  const required: string[] = [];
  
  for (const [key, value] of Object.entries(shape)) {
    if (value instanceof z.ZodString || value instanceof z.ZodNumber) {
      if (!value.isOptional()) {
        required.push(key);
      }
    }
  }
  
  return required;
}

export function checkEnvFile(filePath: string): { 
  exists: boolean; 
  missing: string[];
  invalid: string[];
} {
  const exists = fs.existsSync(filePath);
  
  if (!exists) {
    return { exists: false, missing: [], invalid: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const defined = new Set<string>();
  const invalid: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) {
        defined.add(match[1]);
        // Check if value is empty
        const value = trimmed.substring(match[0].length);
        if (!value || value === '""' || value === "''") {
          invalid.push(match[1]);
        }
      }
    }
  }
  
  return { exists: true, missing: [], invalid };
}

export class EnvError extends Error {
  constructor(
    message: string,
    public readonly missingVars: string[] = [],
    public readonly invalidVars: string[] = []
  ) {
    super(message);
    this.name = 'EnvError';
  }
}

export function rotateSecret(envVar: string, newValue?: string): string {
  const newSecret = newValue || generateSecureToken(32);
  
  // Store old value for rollback if needed
  const oldValue = process.env[envVar];
  
  // Update process env
  process.env[envVar] = newSecret;
  
  // Log rotation (in production, this would go to audit log)
  console.log(`🔄 Rotated secret for ${envVar}`);
  console.log(`   Old (masked): ${oldValue ? maskSecret(oldValue) : 'undefined'}`);
  console.log(`   New (masked): ${maskSecret(newSecret)}`);
  
  return newSecret;
}

export function exportEnvTemplate(schema: z.ZodSchema, outputPath: string): void {
  const shape = (schema as any)._def.shape();
  const lines: string[] = [
    '# ============================================',
    '# Environment Variables Template',
    `# Generated: ${new Date().toISOString()}`,
    '# ============================================',
    '',
  ];
  
  const categories: Record<string, string[]> = {};
  
  for (const [key, value] of Object.entries(shape)) {
    const category = key.split('_')[0];
    if (!categories[category]) {
      categories[category] = [];
    }
    
    const isRequired = !(value as any).isOptional();
    const description = (value as any)._def.description || '';
    const defaultValue = (value as any)._def.defaultValue;
    
    let line = `# ${description}`;
    if (isRequired) {
      line += ' (REQUIRED)';
    }
    if (defaultValue !== undefined) {
      line += ` [default: ${defaultValue}]`;
    }
    
    categories[category].push(line);
    categories[category].push(`${key}=""`);
    categories[category].push('');
  }
  
  for (const [category, vars] of Object.entries(categories)) {
    lines.push(`# ${category}`);
    lines.push('# ' + '='.repeat(40));
    lines.push(...vars);
    lines.push('');
  }
  
  fs.writeFileSync(outputPath, lines.join('\n'));
}