import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
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
        '**/tests/**',
        '**/__tests__/**',
        'coverage/**'
      ]
    },
    testTimeout: 30000, // Longer timeout for worker tests
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@repo/database': resolve(__dirname, '../../packages/database'),
      '@repo/shared': resolve(__dirname, '../../packages/shared'),
      '@repo/redis': resolve(__dirname, '../../packages/redis')
    }
  }
});