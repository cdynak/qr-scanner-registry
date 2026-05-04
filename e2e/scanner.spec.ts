import { test, expect, Page } from "@playwright/test";

// Helper function to login for tests
async function loginUser(page: Page) {
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: /login with google/i });
  await loginButton.click();
  await page.waitForURL("/");
  await expect(page.getByText(/test user/i)).toBeVisible();
}

// Mock camera and scanning functionality
test.beforeEach(async ({ page }) => {
  // Mock Google OAuth (same as auth tests)
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
      body: JSON.stringify({
        id: "mock_google_id",
        email: "test@example.com",
        name: "Test User",
        picture: "https://example.com/avatar.jpg",
      }),
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
          id: "mock_user_id",
          email: "test@example.com",
        },
      }),
    });
  });

  // Mock camera permissions
  await page.addInitScript(() => {
    // Mock getUserMedia
    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          // Create a mock video stream
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d")!;

          // Draw a mock QR code pattern
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#fff";
          ctx.fillRect(100, 100, 200, 200);

          // Create mock stream
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

    // Mock permissions API
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

  // Mock scan API endpoints
  await page.route("**/api/scans/create", async (route) => {
    const request = route.request();
    const body = await request.postDataJSON();

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-scan-id",
        userId: "mock_user_id",
        content: body.content,
        scanType: body.scanType,
        format: body.format,
        scannedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    });
  });
});

test.describe("QR/Barcode Scanner", () => {
  test("should request camera permissions on scanner page", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    // Should show camera permission request or camera interface
    const cameraElement = page.locator('[data-testid="camera-view"], video, canvas');
    await expect(cameraElement.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display camera feed when permissions granted", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    // Wait for camera to initialize
    await page.waitForTimeout(1000);

    // Should show scanning interface
    await expect(page.getByText(/scanning/i)).toBeVisible();

    // Should show camera controls
    const scanButton = page.getByRole("button", { name: /scan/i });
    if (await scanButton.isVisible()) {
      await expect(scanButton).toBeVisible();
    }
  });

  test("should handle camera permission denied", async ({ page }) => {
    // Override camera permissions to be denied
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("Permission denied", "NotAllowedError");
          },
        },
      });
    });

    await loginUser(page);
    await page.goto("/scanner");

    // Should show permission error message
    await expect(page.getByText(/camera permission/i)).toBeVisible();
    await expect(page.getByText(/denied/i)).toBeVisible();
  });

  test("should simulate QR code scanning", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    // Wait for scanner to initialize
    await page.waitForTimeout(1000);

    // Simulate QR code detection by triggering scan result
    await page.evaluate(() => {
      // Simulate scanner detecting a QR code
      const mockScanResult = {
        text: "https://example.com",
        format: "QR_CODE",
      };

      // Dispatch custom event to simulate scan
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: mockScanResult,
        })
      );
    });

    // Should show scan result
    await expect(page.getByText(/https:\/\/example\.com/)).toBeVisible();

    // Should show save option
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible();
  });

  test("should simulate barcode scanning", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    await page.waitForTimeout(1000);

    // Simulate barcode detection
    await page.evaluate(() => {
      const mockScanResult = {
        text: "1234567890123",
        format: "EAN_13",
      };

      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: mockScanResult,
        })
      );
    });

    // Should show barcode result
    await expect(page.getByText(/1234567890123/)).toBeVisible();

    // Should show save option
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible();
  });

  test("should save scan results", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    await page.waitForTimeout(1000);

    // Simulate scan
    await page.evaluate(() => {
      const mockScanResult = {
        text: "Test QR Content",
        format: "QR_CODE",
      };

      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: mockScanResult,
        })
      );
    });

    // Save the scan
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();

    // Should show success message
    await expect(page.getByText(/saved/i)).toBeVisible();
  });

  test("should handle scanning errors", async ({ page }) => {
    // Mock camera error
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("Camera not available", "NotReadableError");
          },
        },
      });
    });

    await loginUser(page);
    await page.goto("/scanner");

    // Should show error message
    await expect(page.getByText(/camera.*not.*available/i)).toBeVisible();

    // Should show retry option
    const retryButton = page.getByRole("button", { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });

  test("should allow multiple scans in sequence", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    await page.waitForTimeout(1000);

    // First scan
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "First scan", format: "QR_CODE" },
        })
      );
    });

    await expect(page.getByText(/first scan/i)).toBeVisible();

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();

    // Should allow new scan
    const newScanButton = page.getByRole("button", { name: /scan again|new scan/i });
    if (await newScanButton.isVisible()) {
      await newScanButton.click();
    }

    // Second scan
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "Second scan", format: "QR_CODE" },
        })
      );
    });

    await expect(page.getByText(/second scan/i)).toBeVisible();
  });

  test("should validate scan content before saving", async ({ page }) => {
    await loginUser(page);
    await page.goto("/scanner");

    await page.waitForTimeout(1000);

    // Simulate scan with empty content
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "", format: "QR_CODE" },
        })
      );
    });

    // Should show validation error
    await expect(page.getByText(/invalid.*content/i)).toBeVisible();
  });
});
