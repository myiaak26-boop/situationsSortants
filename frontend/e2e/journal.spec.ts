import { test, expect } from '@playwright/test'

test.describe('Journal d\'audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/journal')
    await expect(page.getByRole('heading', { name: 'Journal d\'audit' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Journal d\'audit' })).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Rechercher dans le journal...')).toBeVisible({ timeout: 10000 })
  })

  test('should load without errors', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('tbody tr').first().or(page.getByText(/Aucune entrée/i)),
    ).toBeVisible({ timeout: 10000 })
  })
})
