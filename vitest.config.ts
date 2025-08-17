import { defineConfig } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default defineConfig(
  getViteConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '.astro/',
          'coverage/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/test/**',
          '**/e2e/**'
        ],
        threshold: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
          }
        }
      },
      include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
      exclude: ['node_modules/', 'dist/', '.astro/', 'e2e/']
    }
  })
);