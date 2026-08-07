import { test, expect } from '@playwright/test'

test.describe('Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/permissions')
    await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible()
  })

  test('should show role sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Administrateur', exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('should have permission checkboxes', async ({ page }) => {
    await expect(page.getByText('Voir les courriers').first()).toBeVisible({ timeout: 10000 })
  })

  test('should have save button per role', async ({ page }) => {
    const saveButtons = page.getByRole('button', { name: /Enregistrer/ })
    await expect(saveButtons.first()).toBeVisible({ timeout: 10000 })
  })
})
