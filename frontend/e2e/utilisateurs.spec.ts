import { test, expect } from '@playwright/test'

test.describe('Utilisateurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/utilisateurs')
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible()
  })

  test('should display users list', async ({ page }) => {
    await expect(page.getByRole('table').getByText('Admin DEX')).toBeVisible({ timeout: 10000 })
  })

  test('should have add user button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible()
  })

  test('should open create user modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Nouvel utilisateur' })).toBeVisible()
  })

  test('should show role badges', async ({ page }) => {
    await expect(page.getByRole('table').getByText('Administrateur')).toBeVisible({ timeout: 10000 })
  })
})
