import { test, expect } from '@playwright/test'

test.describe('Paramètres', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/parametres')
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible()
  })

  test('should show alert thresholds section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Seuils d\'alerte', exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('should show threshold inputs', async ({ page }) => {
    const inputs = page.locator('input[type="number"]')
    await expect(inputs.first()).toBeVisible({ timeout: 10000 })
    await expect(inputs).toHaveCount(5)
  })

  test('should have save button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible()
  })

  test('should navigate between tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Signataires' }).click()
    await expect(page.getByText('Aucun signataire configuré').or(page.locator('table'))).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Utilisateurs' }).click()
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible({ timeout: 10000 })
  })
})
