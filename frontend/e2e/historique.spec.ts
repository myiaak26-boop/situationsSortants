import { test, expect } from '@playwright/test'

test.describe('Historique', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/historique', { waitUntil: 'networkidle' })
    // Wait for loading spinner to disappear
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 }).catch(() => {})
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Historique des actions' })).toBeVisible({ timeout: 5000 })
  })

  test('should have search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Rechercher par action, courrier')).toBeVisible({ timeout: 5000 })
  })
})
