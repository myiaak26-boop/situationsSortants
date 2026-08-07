import { test, expect } from '@playwright/test'

test.describe('Situations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/situations')
    await expect(page.getByRole('heading', { name: 'Situation des courriers', exact: true })).toBeVisible({ timeout: 15000 })
  })

  test('should display page title and single generate button', async ({ page }) => {
    await expect(page.getByTestId('btn-generer-situation')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Générer une situation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Imprimer' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'PDF Exécutif' })).not.toBeVisible()
  })

  test('should show situation stats and charts', async ({ page }) => {
    await expect(page.getByText('Total courriers')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Par signataire' })).toBeVisible()
    await expect(page.getByText('Répartition par situation')).toBeVisible()
    await expect(page.getByText('Évolution des envois')).toBeVisible()
  })

  test('should filter by period', async ({ page }) => {
    await page.getByRole('button', { name: "Aujourd'hui" }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Total courriers')).toBeVisible()
  })

  test('generates a report in a single screen and refreshes history', async ({ page }) => {
    const historyTable = page.locator('table').nth(1)

    await page.getByTestId('btn-generer-situation').click()
    await expect(page.getByTestId('wizard-type-generale')).toBeVisible()

    // Période par défaut sûre : « Ce mois »
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Ce mois' })).toHaveClass(/bg-primary/)

    await page.getByTestId('wizard-format-exec-xlsx').click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('wizard-generate').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^situation-executive-ST-\d{8}-\d{4}\.xlsx$/)

    await expect(page.getByText('Historique des situations générées')).toBeVisible()
    await expect
      .poll(() => historyTable.locator('tbody tr').first().textContent(), { timeout: 10000 })
      .toContain('Excel Exécutif')
    await expect(historyTable.locator('tbody tr').first()).toContainText('Générale')
  })

  test('presets filter the report without manual flags', async ({ page }) => {
    await page.getByTestId('btn-generer-situation').click()
    await page.getByTestId('wizard-type-retraits').click()
    await expect(page.getByTestId('wizard-type-retraits')).toHaveClass(/border-primary/)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('wizard-generate').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^situation-executive-ST-\d{8}-\d{4}\.pdf$/)
  })

  test('advanced options: group by signataire', async ({ page }) => {
    await page.getByTestId('btn-generer-situation').click()
    await page.getByRole('button', { name: 'Options avancées' }).click()
    await page.getByRole('dialog').locator('select').nth(2).selectOption('signataire')
    await expect(page.getByRole('dialog').locator('select').nth(2)).toHaveValue('signataire')
  })

  test('should display history table with columns and actions', async ({ page }) => {
    await expect(page.getByText('Historique des situations générées')).toBeVisible()
    for (const col of ['Date', 'Utilisateur', 'Type', 'Période', 'Format', 'Taille', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible()
    }
    const historyTable = page.locator('table').nth(1)
    if ((await historyTable.locator('tbody tr').count()) > 0) {
      await expect(historyTable.getByRole('button', { name: 'Télécharger' }).first()).toBeVisible()
    }
  })
})
