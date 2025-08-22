import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        '*.config.js',
        '*.config.mjs',
        '**/*.d.ts',
        '**/*.types.ts',
        'test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/scripts/**',
        '**/prisma/**',
        '.next/**',
        'coverage/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts'
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@repo/database': resolve(__dirname, './packages/database'),
      '@repo/shared': resolve(__dirname, './packages/shared'),
      '@repo/ui': resolve(__dirname, './packages/ui'),
      '@repo/redis': resolve(__dirname, './packages/redis')
    }
  }
});