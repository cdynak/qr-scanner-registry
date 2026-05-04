import { Page } from "@playwright/test";

// Test database configuration
export const TEST_DATABASE_CONFIG = {
  supabaseUrl: process.env.TEST_SUPABASE_URL || "https://test.supabase.co",
  supabaseAnonKey: process.env.TEST_SUPABASE_ANON_KEY || "test-anon-key",
  supabaseServiceKey: process.env.TEST_SUPABASE_SERVICE_KEY || "test-service-key",
};

// Mock user data for tests
export const MOCK_USER = {
  id: "mock_user_id",
  googleId: "mock_google_id",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.jpg",
};

// Mock scan data for tests
export const MOCK_SCANS = [
  {
    id: "scan-1",
    userId: "mock_user_id",
    content: "https://example.com",
    scanType: "qr" as const,
    format: "QR_CODE",
    scannedAt: "2024-01-15T10:30:00Z",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "scan-2",
    userId: "mock_user_id",
    content: "1234567890123",
    scanType: "barcode" as const,
    format: "EAN_13",
    scannedAt: "2024-01-14T15:45:00Z",
    createdAt: "2024-01-14T15:45:00Z",
  },
];

// Helper function to setup authentication mocks
export async function setupAuthMocks(page: Page) {
  await page.route("https://accounts.google.com/oauth/authorize**", async (route) => {
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");

    if (redirectUri) {
      await route.fulfill({
        status: 302,
        headers: {
          Location: `${redirectUri}?code=mock_auth_code&state=${state}`,
        },
      });
    }
  });

  await page.route("https://oauth2.googleapis.com/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock_access_token",
        id_token: "mock_id_token",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });
  });

  await page.route("https://www.googleapis.com/oauth2/v2/userinfo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock_supabase_token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: MOCK_USER.id,
          email: MOCK_USER.email,
        },
      }),
    });
  });
}

// Helper function to setup camera mocks
export async function setupCameraMocks(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d")!;

          // Draw a simple pattern
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#fff";
          ctx.fillRect(100, 100, 200, 200);

          const stream = canvas.captureStream(30);
          return stream;
        },
        enumerateDevices: async () => [
          {
            deviceId: "mock-camera",
            groupId: "mock-group",
            kind: "videoinput" as MediaDeviceKind,
            label: "Mock Camera",
          },
        ],
      },
    });

    Object.defineProperty(navigator, "permissions", {
      writable: true,
      value: {
        query: async (permission: { name: string }) => ({
          state: "granted" as PermissionState,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      },
    });
  });
}

// Helper function to setup scan API mocks
export async function setupScanApiMocks(page: Page, mockScans: any[] = [...MOCK_SCANS]) {
  await page.route("**/api/scans/create", async (route) => {
    const body = await route.request().postDataJSON();
    const newScan = {
      id: `scan-${Date.now()}`,
      userId: MOCK_USER.id,
      content: body.content,
      scanType: body.scanType,
      format: body.format,
      scannedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    mockScans.unshift(newScan);

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(newScan),
    });
  });

  await page.route("**/api/scans/list**", async (route) => {
    const url = new URL(route.request().url());
    const page_param = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "10";

    const pageNum = parseInt(page_param);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedScans = mockScans.slice(startIndex, endIndex);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scans: paginatedScans,
        total: mockScans.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(mockScans.length / limitNum),
      }),
    });
  });

  await page.route("**/api/scans/delete", async (route) => {
    const body = await route.request().postDataJSON();
    const scanIndex = mockScans.findIndex((scan) => scan.id === body.scanId);
    if (scanIndex > -1) {
      mockScans.splice(scanIndex, 1);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scan not found" }),
      });
    }
  });
}

// Helper function to simulate QR code scan
export async function simulateQRScan(page: Page, content: string, format = "QR_CODE") {
  await page.evaluate(
    ({ content, format }) => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: content, format },
        })
      );
    },
    { content, format }
  );
}

// Helper function to login user
export async function loginUser(page: Page) {
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: /login with google/i });
  await loginButton.click();
  await page.waitForURL("/");
}

// Helper function to setup test environment
export async function setupTestEnvironment(page: Page) {
  await setupAuthMocks(page);
  await setupCameraMocks(page);
  await setupScanApiMocks(page);
}

// Test data cleanup
export function cleanupTestData() {
  // Reset mock data between tests
  MOCK_SCANS.length = 0;
  MOCK_SCANS.push(
    {
      id: "scan-1",
      userId: "mock_user_id",
      content: "https://example.com",
      scanType: "qr" as const,
      format: "QR_CODE",
      scannedAt: "2024-01-15T10:30:00Z",
      createdAt: "2024-01-15T10:30:00Z",
    },
    {
      id: "scan-2",
      userId: "mock_user_id",
      content: "1234567890123",
      scanType: "barcode" as const,
      format: "EAN_13",
      scannedAt: "2024-01-14T15:45:00Z",
      createdAt: "2024-01-14T15:45:00Z",
    }
  );
}
