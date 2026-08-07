import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
  })

  test('should display all stat cards', async ({ page }) => {
    const stats = [
      'Total courriers',
      'Courriers simples',
      'Courriers réponses',
      'Retirés',
      'Injoignables',
    ]
    for (const stat of stats) {
      await expect(page.getByRole('paragraph').filter({ hasText: new RegExp(`^${stat}$`) })).toBeVisible()
    }
  })

  test('should display recent activities section', async ({ page }) => {
    await expect(page.getByText('Activités récentes').first()).toBeVisible()
  })

  test('should display signataire distribution', async ({ page }) => {
    await expect(page.getByText('Par signataire')).toBeVisible()
  })

  test('should have sidebar navigation', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Courriers sortants' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Situations' })).toBeVisible()
  })
})
