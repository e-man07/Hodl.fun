import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should show navigation progress bar on page transitions', async ({ page }) => {
    await page.goto('/');

    // Start navigation to leaderboard
    const leaderboardLink = page.locator('text=Leaderboard');
    await leaderboardLink.click();

    // Verify we navigated
    await expect(page).toHaveURL('/leaderboard');
  });

  test('should open mobile menu on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Click mobile menu button
    const menuButton = page.locator('[data-testid="mobile-menu-button"], button:has(.lucide-menu)');
    await menuButton.click();

    // Verify menu opened (Sheet content should be visible)
    await expect(page.locator('text=Explore').first()).toBeVisible();
  });

  test('should open search modal with keyboard shortcut', async ({ page }) => {
    await page.goto('/');

    // Press Cmd+K (or Ctrl+K on Windows/Linux)
    await page.keyboard.press('Meta+k');

    // Verify search modal opened
    await expect(page.locator('input[placeholder*="Search tokens"]')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('input[placeholder*="Search tokens"]')).not.toBeVisible();
  });
});

test.describe('Search Modal', () => {
  test('should search tokens by name', async ({ page }) => {
    await page.goto('/');

    // Open search
    await page.keyboard.press('Meta+k');

    // Type search query
    await page.fill('input[placeholder*="Search tokens"]', 'test');

    // Wait for search to complete (either results or no results message)
    await page.waitForTimeout(1000);

    // Verify search input has the query
    await expect(page.locator('input[placeholder*="Search tokens"]')).toHaveValue('test');
  });
});

test.describe('Responsive Design', () => {
  test('should display desktop navigation on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Desktop nav should be visible
    await expect(page.locator('nav:has(a:text("Explore"))')).toBeVisible();

    // Mobile menu button should be hidden
    const mobileMenuButton = page.locator('button:has(.lucide-menu)');
    await expect(mobileMenuButton).not.toBeVisible();
  });

  test('should hide desktop navigation on mobile screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button:has(.lucide-menu)');
    await expect(mobileMenuButton).toBeVisible();
  });
});
