import { test, expect } from '@playwright/test'

test.describe('Rôles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roles')
    await expect(page.getByRole('heading', { name: 'Rôles' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async () => {
    // checked in beforeEach
  })

  test('should display roles list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Administrateur', exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('should have add role button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible()
  })

  test('should open create role modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Nouveau rôle' })).toBeVisible()
  })

  test('should show permission badges', async ({ page }) => {
    await expect(page.getByText('courrier:read')).toBeVisible({ timeout: 10000 })
  })
})
