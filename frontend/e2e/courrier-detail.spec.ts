import { test, expect } from '@playwright/test'

test.describe('Courrier detail', () => {
  test('should show error for invalid id', async ({ page }) => {
    await page.goto('/courriers/invalid-id')
    await expect(page.getByText('Courrier introuvable')).toBeVisible()
  })

  test('should navigate back to list', async ({ page }) => {
    await page.goto('/courriers/invalid-id')
    await expect(page.getByRole('link', { name: 'Courriers' })).toBeVisible()
  })
})
