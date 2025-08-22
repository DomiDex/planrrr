#!/usr/bin/env node
// Package: @repo/api
// Path: apps/api/src/scripts/generate-client.ts
// Dependencies: @orpc/client, fs

import { writeFileSync } from 'fs';
import { join } from 'path';
// Type imported for validation only
import type { } from '../procedures/index.js';

// Generate TypeScript client code
const clientCode = `// Auto-generated ORPC Client
// Generated at: ${new Date().toISOString()}

import { createClient } from '@orpc/client';
import type { ApiRouter } from '@repo/api/procedures';

export function createApiClient(baseUrl: string, options?: {
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}) {
  return createClient<ApiRouter>({
    url: \`\${baseUrl}/api/orpc\`,
    headers: options?.headers,
    fetch: options?.fetch || fetch
  });
}

// Typed client with auth helpers
export class PlanrrrApiClient {
  private client: ReturnType<typeof createApiClient>;
  private token?: string;
  
  constructor(baseUrl: string, options?: {
    token?: string;
    headers?: Record<string, string>;
  }) {
    this.token = options?.token;
    this.client = createApiClient(baseUrl, {
      headers: {
        ...options?.headers,
        ...(this.token && { Authorization: \`Bearer \${this.token}\` })
      }
    });
  }
  
  setToken(token: string) {
    this.token = token;
    this.client = createApiClient(this.client.url, {
      headers: {
        Authorization: \`Bearer \${token}\`
      }
    });
  }
  
  clearToken() {
    this.token = undefined;
    this.client = createApiClient(this.client.url);
  }
  
  // Auth methods
  async login(email: string, password: string) {
    const result = await this.client.auth.login({ email, password });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }
  
  async register(email: string, password: string, name: string) {
    const result = await this.client.auth.register({ email, password, name });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }
  
  async logout() {
    const result = await this.client.auth.logout();
    this.clearToken();
    return result;
  }
  
  // Direct access to all procedures
  get auth() { return this.client.auth; }
  get posts() { return this.client.posts; }
  get team() { return this.client.team; }
  get connections() { return this.client.connections; }
  get ai() { return this.client.ai; }
  get health() { return this.client.health; }
}

// Export types
export type { ApiRouter };
`;

// Write client to packages directory
const outputPath = join(process.cwd(), '../../packages/api-client/src/index.ts');
console.log('Generating ORPC client to:', outputPath);

try {
  // Create directory if it doesn't exist
  const { mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  mkdirSync(dirname(outputPath), { recursive: true });
  
  // Write the client code
  writeFileSync(outputPath, clientCode);
  console.log('✅ Client generated successfully');
  
  // Generate package.json for the client
  const packageJson = {
    name: '@repo/api-client',
    version: '1.0.0',
    description: 'Generated ORPC client for Planrrr API',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    scripts: {
      build: 'tsc',
      'type-check': 'tsc --noEmit'
    },
    dependencies: {
      '@orpc/client': '^1.0.0'
    },
    devDependencies: {
      '@repo/typescript-config': 'workspace:*',
      'typescript': '^5.3.3'
    },
    peerDependencies: {
      '@repo/api': 'workspace:*'
    }
  };
  
  writeFileSync(
    join(dirname(outputPath), '..', 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Generate tsconfig.json
  const tsconfig = {
    extends: '@repo/typescript-config/base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src'
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };
  
  writeFileSync(
    join(dirname(outputPath), '..', 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
  
  console.log('✅ Package configuration generated');
  console.log('\nTo use the client in your app:');
  console.log('1. Add "@repo/api-client": "workspace:*" to your package.json');
  console.log('2. Run pnpm install');
  console.log('3. Import and use: import { PlanrrrApiClient } from "@repo/api-client"');
  
} catch (error) {
  console.error('❌ Error generating client:', error);
  process.exit(1);
}