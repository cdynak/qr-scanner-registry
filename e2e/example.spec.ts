import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  
  // Basic smoke test to ensure the app loads
  await expect(page).toHaveTitle(/QR Scanner Registry/);
});