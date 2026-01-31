import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Hodl.fun')).toBeVisible();
  });

  test('should display explore section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Search tokens')).toBeVisible();
  });

  test('should navigate to launch page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Launch');
    await expect(page).toHaveURL('/launch');
    await expect(page.locator('text=Launch Your Token')).toBeVisible();
  });

  test('should navigate to leaderboard page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Leaderboard');
    await expect(page).toHaveURL('/leaderboard');
    await expect(page.locator('h1:has-text("Leaderboard")')).toBeVisible();
  });
});

test.describe('Token Page', () => {
  test('should display token not found for invalid address', async ({ page }) => {
    await page.goto('/token/0xinvalidaddress');
    await expect(page.locator('text=Token Not Found')).toBeVisible();
  });
});

test.describe('Launch Page', () => {
  test('should display launch form', async ({ page }) => {
    await page.goto('/launch');
    await expect(page.locator('input[placeholder*="My Awesome Token"]')).toBeVisible();
    await expect(page.locator('input[placeholder="MAT"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/launch');
    await page.click('button:has-text("Connect Wallet")');
    // Form validation should prevent submission without name/symbol
  });
});
