import { vi } from "vitest";
import type { APIContext } from "astro";
import { generateCSRFToken } from "../../lib/csrf";

/**
 * Test helpers for API route testing
 */

export interface MockAPIContext {
  request: Request;
  cookies: {
    get: (name: string) => { value?: string } | undefined;
    set: (name: string, value: string, options?: any) => void;
    delete: (name: string) => void;
  };
  redirect: (url: string) => Response;
  locals: {
    user?: any;
    session?: any;
  };
}

/**
 * Creates a mock API context for testing
 */
export function createMockAPIContext(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  user?: any;
  session?: any;
  includeCSRF?: boolean;
}): MockAPIContext {
  const {
    method = "GET",
    url = "http://localhost:3000/api/test",
    body,
    headers = {},
    cookies = {},
    user,
    session,
    includeCSRF = true,
  } = options;

  // Generate CSRF token if needed
  let csrfToken: string | undefined;
  if (includeCSRF && method !== "GET") {
    csrfToken = generateCSRFToken();
    headers["x-csrf-token"] = csrfToken;
    cookies["csrf-token"] = csrfToken;
  }

  const request = new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const mockCookies = {
    get: vi.fn((name: string) => {
      const value = cookies[name];
      return value ? { value } : undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const mockRedirect = vi.fn((url: string) => new Response(null, {
    status: 302,
    headers: { Location: url },
  }));

  return {
    request,
    cookies: mockCookies,
    redirect: mockRedirect,
    locals: {
      user,
      session,
    },
  };
}

/**
 * Creates a mock authenticated user for testing
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: "user-123",
    googleId: "google-123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: "https://example.com/avatar.jpg",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Creates a mock session for testing
 */
export function createMockSession(user?: any) {
  const mockUser = user || createMockUser();
  return {
    user: mockUser,
    accessToken: "mock-access-token",
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  };
}

/**
 * Asserts that a response has the expected status and structure
 */
export async function assertAPIResponse(
  response: Response,
  expectedStatus: number,
  expectedStructure?: {
    hasData?: boolean;
    hasError?: boolean;
    hasMessage?: boolean;
    hasPagination?: boolean;
  }
) {
  expect(response.status).toBe(expectedStatus);
  
  if (expectedStructure) {
    const data = await response.json();
    
    if (expectedStructure.hasData) {
      expect(data).toHaveProperty("data");
    }
    
    if (expectedStructure.hasError) {
      expect(data).toHaveProperty("error");
    }
    
    if (expectedStructure.hasMessage) {
      expect(data).toHaveProperty("message");
    }
    
    if (expectedStructure.hasPagination) {
      expect(data).toHaveProperty("pagination");
    }
  }
}

/**
 * Mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockGte = vi.fn().mockReturnThis();
  const mockLte = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();
  const mockSingle = vi.fn();

  const mockQueryChain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
  };

  const mockFrom = vi.fn().mockReturnValue(mockQueryChain);

  const mockClient = {
    from: mockFrom,
  };

  return {
    client: mockClient,
    mocks: {
      from: mockFrom,
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      order: mockOrder,
      limit: mockLimit,
      range: mockRange,
      single: mockSingle,
      queryChain: mockQueryChain,
    },
  };
}