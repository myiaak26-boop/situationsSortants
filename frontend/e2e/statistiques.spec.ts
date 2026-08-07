import { test, expect } from '@playwright/test'

test.describe('Statistiques', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/statistiques')
    await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible()
  })

  test('should show total courriers stat', async ({ page }) => {
    await expect(page.getByText('Total courriers', { exact: false })).toBeVisible({ timeout: 10000 })
  })

  test('should show monthly evolution chart', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Évolution mensuelle' })).toBeVisible({ timeout: 10000 })
  })

  test('should show distribution chart', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Distribution par statut' })).toBeVisible({ timeout: 10000 })
  })

  test('should show top destinataires', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Top destinataires' })).toBeVisible({ timeout: 10000 })
  })
})
