import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react() as any, tsconfigPaths() as any],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
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
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/hooks': resolve(__dirname, './hooks'),
      '@/server': resolve(__dirname, './server'),
      '@/types': resolve(__dirname, './types'),
      '@repo/database': resolve(__dirname, '../../packages/database'),
      '@repo/ui': resolve(__dirname, '../../packages/ui'),
      '@repo/shared': resolve(__dirname, '../../packages/shared')
    }
  }
});