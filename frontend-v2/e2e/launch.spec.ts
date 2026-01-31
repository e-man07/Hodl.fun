import { test, expect } from '@playwright/test';

test.describe('Launch Page', () => {
  test('should display launch form with all fields', async ({ page }) => {
    await page.goto('/launch');

    // Title
    await expect(page.locator('h1:has-text("Launch Your Token")')).toBeVisible();

    // Form fields
    await expect(page.locator('input[placeholder*="My Awesome Token"]')).toBeVisible();
    await expect(page.locator('input[placeholder="MAT"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="description"]')).toBeVisible();

    // Logo upload
    await expect(page.locator('input[type="file"]')).toBeVisible();

    // Initial buy field
    await expect(page.locator('input[placeholder="0.0"]')).toBeVisible();

    // Submit button (Connect Wallet when not connected)
    await expect(page.locator('button:has-text("Connect Wallet"), button:has-text("Launch Token")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/launch');

    // Try to submit empty form by clicking the button
    // Form validation should prevent submission
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Check for HTML5 validation (required fields)
    const nameInput = page.locator('input[placeholder*="My Awesome Token"]');
    await expect(nameInput).toHaveAttribute('required');
  });

  test('should convert symbol to uppercase', async ({ page }) => {
    await page.goto('/launch');

    const symbolInput = page.locator('input[placeholder="MAT"]');
    await symbolInput.fill('test');

    // Symbol should be converted to uppercase
    await expect(symbolInput).toHaveValue('TEST');
  });

  test('should show cost summary', async ({ page }) => {
    await page.goto('/launch');

    // Deploy fee should be visible
    await expect(page.locator('text=Deploy Fee')).toBeVisible();
    await expect(page.locator('text=Total')).toBeVisible();
  });

  test('should update total when initial buy is entered', async ({ page }) => {
    await page.goto('/launch');

    // Enter initial buy amount
    const initialBuyInput = page.locator('input[placeholder="0.0"]');
    await initialBuyInput.fill('1');

    // Should show Initial Buy in cost summary
    await expect(page.locator('text=Initial Buy')).toBeVisible();
  });

  test('should show how it works info', async ({ page }) => {
    await page.goto('/launch');

    await expect(page.locator('text=How it works')).toBeVisible();
    await expect(page.locator('text=bonding curve')).toBeVisible();
    await expect(page.locator('text=creator')).toBeVisible();
  });
});

test.describe('Launch Page - IPFS Status', () => {
  test('should indicate IPFS upload status', async ({ page }) => {
    await page.goto('/launch');

    // Should show either "IPFS enabled" or "Logo won't be uploaded"
    const ipfsStatus = page.locator('text=IPFS enabled, text=Logo won\'t be uploaded');
    await expect(ipfsStatus.first()).toBeVisible();
  });
});
