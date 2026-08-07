import { test, expect } from '@playwright/test'

test.describe('Import Excel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import')
  })

  test('should display import page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Importation Excel' })).toBeVisible()
  })

  test('should display expected columns', async ({ page }) => {
    const cols = ['Numéro', "Date d'envoi", 'Destinataire', 'Objet', 'Signataire']
    for (const col of cols) {
      await expect(page.getByText(col)).toBeVisible()
    }
  })

  test('should have upload zone', async ({ page }) => {
    await expect(page.getByText('Déposer le fichier ici')).toBeVisible()
  })

  test('should show file name after selection', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Déposer le fichier ici').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test'),
    })
    await expect(page.getByText('test.xlsx')).toBeVisible()
  })
})
