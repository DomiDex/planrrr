import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        '*.config.js',
        '**/*.d.ts',
        '**/*.types.ts',
        'test/**',
        '**/test-utils/**',
        '**/__tests__/**',
        'coverage/**'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'threads'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/test-utils': resolve(__dirname, './src/test-utils'),
      '@test': resolve(__dirname, './src/test-utils'),
      '@repo/database': resolve(__dirname, '../../packages/database'),
      '@repo/shared': resolve(__dirname, '../../packages/shared'),
      '@repo/redis': resolve(__dirname, '../../packages/redis')
    }
  }
});