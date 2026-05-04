import { test, expect } from "./setup";

test.describe("Page Navigation and Routing", () => {
  test.describe("Unauthenticated User Navigation", () => {
    test("should display home page with login prompt for unauthenticated users", async ({ page }) => {
      await page.goto("/");

      // Check page title and main heading
      await expect(page).toHaveTitle(/QR Scanner Registry - Home/);
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();

      // Should show unauthenticated content
      await expect(page.getByText("Welcome!")).toBeVisible();
      await expect(page.getByText("Sign in with your Google account")).toBeVisible();
      await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();

      // Should not show authenticated content
      await expect(page.getByText("Start Scanning")).not.toBeVisible();
      await expect(page.getByText("Scan History")).not.toBeVisible();
    });

    test("should redirect to login when accessing scanner page without authentication", async ({ page }) => {
      await page.goto("/scanner");

      // Check page title
      await expect(page).toHaveTitle(/QR Scanner Registry - Scanner/);

      // Should show authentication required message
      await expect(page.getByText("Authentication Required")).toBeVisible();
      await expect(page.getByText("You need to sign in with your Google account to access the scanner")).toBeVisible();
      await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();

      // Should not show scanner content
      await expect(page.getByText("QR & Barcode Scanner")).not.toBeVisible();
    });

    test("should redirect to login when accessing history page without authentication", async ({ page }) => {
      await page.goto("/history");

      // Check page title
      await expect(page).toHaveTitle(/QR Scanner Registry - Scan History/);

      // Should show authentication required message
      await expect(page.getByText("Authentication Required")).toBeVisible();
      await expect(
        page.getByText("You need to sign in with your Google account to view your scan history")
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();

      // Should not show history content
      await expect(page.getByText("Scan History")).not.toBeVisible();
    });

    test("should display 404 page for non-existent routes", async ({ page }) => {
      await page.goto("/non-existent-page");

      // Check 404 page content
      await expect(page).toHaveTitle(/Page Not Found - QR Scanner Registry/);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
      await expect(page.getByText("Sorry, we couldn't find the page you're looking for")).toBeVisible();

      // Check navigation links
      await expect(page.getByRole("link", { name: /go to home/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /scanner/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /history/i })).toBeVisible();
    });

    test("should navigate between pages using navigation links on 404 page", async ({ page }) => {
      await page.goto("/non-existent-page");

      // Navigate to home from 404 page
      await page.getByRole("link", { name: /go to home/i }).click();
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();

      // Go back to 404 and navigate to scanner
      await page.goto("/non-existent-page");
      await page.getByRole("link", { name: /scanner/i }).click();
      await expect(page).toHaveURL("/scanner");
      await expect(page.getByText("Authentication Required")).toBeVisible();

      // Go back to 404 and navigate to history
      await page.goto("/non-existent-page");
      await page.getByRole("link", { name: /history/i }).click();
      await expect(page).toHaveURL("/history");
      await expect(page.getByText("Authentication Required")).toBeVisible();
    });
  });

  test.describe("Authenticated User Navigation", () => {
    test("should display home page with scanner access for authenticated users", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");

      // Check page title and main heading
      await expect(page).toHaveTitle(/QR Scanner Registry - Home/);
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();

      // Should show authenticated content
      await expect(page.getByText("Start Scanning")).toBeVisible();
      await expect(page.getByText("Scan History")).toBeVisible();
      await expect(page.getByRole("link", { name: /open scanner/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /view history/i })).toBeVisible();

      // Should not show unauthenticated content
      await expect(page.getByText("Welcome!")).not.toBeVisible();
      await expect(page.getByText("Sign in with your Google account")).not.toBeVisible();
    });

    test("should access scanner page when authenticated", async ({ authenticatedPage: page }) => {
      await page.goto("/scanner");

      // Check page title and content
      await expect(page).toHaveTitle(/QR Scanner Registry - Scanner/);
      await expect(page.getByRole("heading", { name: "QR & Barcode Scanner" })).toBeVisible();
      await expect(page.getByText("Position a QR code or barcode in front of your camera")).toBeVisible();

      // Should show scanner instructions
      await expect(page.getByText("How to Scan")).toBeVisible();
      await expect(page.getByText("Allow Camera Access")).toBeVisible();
      await expect(page.getByText("Position the Code")).toBeVisible();

      // Should show navigation links
      await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /view history/i })).toBeVisible();
    });

    test("should access history page when authenticated", async ({ authenticatedPage: page }) => {
      await page.goto("/history");

      // Check page title and content
      await expect(page).toHaveTitle(/QR Scanner Registry - Scan History/);
      await expect(page.getByRole("heading", { name: "Scan History" })).toBeVisible();
      await expect(page.getByText("View and manage all your scanned QR codes and barcodes")).toBeVisible();

      // Should show new scan button
      await expect(page.getByRole("link", { name: /new scan/i })).toBeVisible();

      // Should show help section
      await expect(page.getByText("Managing Your Scans")).toBeVisible();
      await expect(page.getByText("View Details")).toBeVisible();

      // Should show navigation links
      await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /scanner/i })).toBeVisible();
    });

    test("should navigate between pages using home page links", async ({ authenticatedPage: page }) => {
      await page.goto("/");

      // Navigate to scanner from home
      await page.getByRole("link", { name: /open scanner/i }).click();
      await expect(page).toHaveURL("/scanner");
      await expect(page.getByRole("heading", { name: "QR & Barcode Scanner" })).toBeVisible();

      // Navigate back to home
      await page.getByRole("link", { name: /home/i }).click();
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();

      // Navigate to history from home
      await page.getByRole("link", { name: /view history/i }).click();
      await expect(page).toHaveURL("/history");
      await expect(page.getByRole("heading", { name: "Scan History" })).toBeVisible();
    });

    test("should navigate between scanner and history pages", async ({ authenticatedPage: page }) => {
      await page.goto("/scanner");

      // Navigate to history from scanner
      await page.getByRole("link", { name: /view history/i }).click();
      await expect(page).toHaveURL("/history");
      await expect(page.getByRole("heading", { name: "Scan History" })).toBeVisible();

      // Navigate back to scanner from history
      await page.getByRole("link", { name: /scanner/i }).click();
      await expect(page).toHaveURL("/scanner");
      await expect(page.getByRole("heading", { name: "QR & Barcode Scanner" })).toBeVisible();

      // Navigate to scanner using "New Scan" button from history
      await page.goto("/history");
      await page.getByRole("link", { name: /new scan/i }).click();
      await expect(page).toHaveURL("/scanner");
      await expect(page.getByRole("heading", { name: "QR & Barcode Scanner" })).toBeVisible();
    });

    test("should maintain authentication state across page navigation", async ({ authenticatedPage: page }) => {
      // Start on home page
      await page.goto("/");
      await expect(page.getByText(/test user/i)).toBeVisible();

      // Navigate to scanner
      await page.goto("/scanner");
      await expect(page.getByRole("heading", { name: "QR & Barcode Scanner" })).toBeVisible();
      await expect(page.getByText("Authentication Required")).not.toBeVisible();

      // Navigate to history
      await page.goto("/history");
      await expect(page.getByRole("heading", { name: "Scan History" })).toBeVisible();
      await expect(page.getByText("Authentication Required")).not.toBeVisible();

      // Navigate back to home
      await page.goto("/");
      await expect(page.getByText(/test user/i)).toBeVisible();
      await expect(page.getByText("Welcome!")).not.toBeVisible();
    });
  });

  test.describe("Error Page Functionality", () => {
    test("should display error page with proper error information", async ({ page }) => {
      await page.goto("/error?code=500&message=Server Error&details=The server encountered an unexpected condition");

      // Check error page content
      await expect(page).toHaveTitle(/Internal Server Error - QR Scanner Registry/);
      await expect(page.getByRole("heading", { name: "500" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Internal Server Error" })).toBeVisible();
      await expect(page.getByText("Server Error")).toBeVisible();
      await expect(page.getByText("The server encountered an unexpected condition")).toBeVisible();

      // Check error-specific guidance
      await expect(page.getByText("Our servers are experiencing issues")).toBeVisible();
    });

    test("should display 401 error page with authentication guidance", async ({ page }) => {
      await page.goto(
        "/error?code=401&message=Unauthorized Access&details=You need to authenticate to access this resource"
      );

      // Check error page content
      await expect(page).toHaveTitle(/Unauthorized - QR Scanner Registry/);
      await expect(page.getByRole("heading", { name: "401" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Unauthorized" })).toBeVisible();

      // Check authentication guidance
      await expect(page.getByText("You need to sign in to access this resource")).toBeVisible();
    });

    test("should navigate from error page to home", async ({ page }) => {
      await page.goto("/error?code=500");

      // Navigate to home from error page
      await page.getByRole("link", { name: /go to home/i }).click();
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();
    });

    test("should handle browser back button on error page", async ({ page }) => {
      // Start on home page
      await page.goto("/");

      // Navigate to error page
      await page.goto("/error?code=404");

      // Use browser back button
      await page.goBack();
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();
    });
  });

  test.describe("Navigation Header", () => {
    test("should display navigation header on main pages", async ({ authenticatedPage: page }) => {
      // Check navigation on home page
      await page.goto("/");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("nav")).toBeVisible();

      // Check navigation on scanner page
      await page.goto("/scanner");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("nav")).toBeVisible();

      // Check navigation on history page
      await page.goto("/history");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("nav")).toBeVisible();
    });

    test("should not display navigation header on error pages", async ({ page }) => {
      // Check 404 page
      await page.goto("/404");
      await expect(page.locator("header")).not.toBeVisible();

      // Check error page
      await page.goto("/error?code=500");
      await expect(page.locator("header")).not.toBeVisible();
    });
  });

  test.describe("Page Accessibility", () => {
    test("should have proper heading hierarchy on all pages", async ({ authenticatedPage: page }) => {
      // Home page
      await page.goto("/");
      const homeH1 = page.getByRole("heading", { level: 1 });
      await expect(homeH1).toHaveCount(1);
      await expect(homeH1).toHaveText("QR Scanner Registry");

      // Scanner page
      await page.goto("/scanner");
      const scannerH1 = page.getByRole("heading", { level: 1 });
      await expect(scannerH1).toHaveCount(1);
      await expect(scannerH1).toHaveText("QR & Barcode Scanner");

      // History page
      await page.goto("/history");
      const historyH1 = page.getByRole("heading", { level: 1 });
      await expect(historyH1).toHaveCount(1);
      await expect(historyH1).toHaveText("Scan History");
    });

    test("should have proper page titles for SEO", async ({ page }) => {
      // Home page
      await page.goto("/");
      await expect(page).toHaveTitle("QR Scanner Registry - Home");

      // Scanner page
      await page.goto("/scanner");
      await expect(page).toHaveTitle("QR Scanner Registry - Scanner");

      // History page
      await page.goto("/history");
      await expect(page).toHaveTitle("QR Scanner Registry - Scan History");

      // 404 page
      await page.goto("/non-existent");
      await expect(page).toHaveTitle("Page Not Found - QR Scanner Registry");

      // Error page
      await page.goto("/error?code=500");
      await expect(page).toHaveTitle("Internal Server Error - QR Scanner Registry");
    });
  });
});
