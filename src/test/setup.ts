import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock environment variables for testing
beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
});

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Global test cleanup
afterAll(() => {
  // Any global cleanup if needed
});

// Mock camera API for testing
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    })
  }
});

// Mock Google OAuth
global.google = {
  accounts: {
    id: {
      initialize: vi.fn(),
      renderButton: vi.fn(),
      prompt: vi.fn()
    }
  }
} as any;