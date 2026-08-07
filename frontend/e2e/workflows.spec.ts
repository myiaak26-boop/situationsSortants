import { test, expect } from '@playwright/test'

test.describe('Page d\'administration des workflows', () => {
  test('affiche les onglets et les modes de transmission', async ({ page }) => {
    await page.goto('/workflows')
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
    await expect(page.getByTestId('tab-modes')).toBeVisible()
    await expect(page.getByTestId('tab-situations')).toBeVisible()
    await expect(page.getByTestId('tab-transitions')).toBeVisible()

    await expect(page.getByTestId('mode-Retrait au Secrétariat')).toBeVisible()
    await expect(page.getByTestId('mode-Envoi par E-mail')).toBeVisible()
    await expect(page.getByTestId('mode-Remise au Coursier')).toBeVisible()
  })

  test('liste les situations avec leurs marqueurs', async ({ page }) => {
    await page.goto('/workflows')
    await page.getByTestId('tab-situations').click()
    await expect(page.getByTestId('situation-Retiré')).toBeVisible()
    await expect(page.getByTestId('situation-Clôturé')).toBeVisible()
    await expect(page.getByTestId('situation-Nouveau')).toContainText('Initiale')
    await expect(page.getByTestId('situation-Clôturé')).toContainText('Finale')
  })

  test('filtre les transitions par mode', async ({ page }) => {
    await page.goto('/workflows')
    await page.getByTestId('tab-transitions').click()

    await page.getByTestId('select-mode-transitions').selectOption({ label: 'Remise au Coursier' })
    await expect(page.getByTestId('transition-Transmettre au coursier')).toBeVisible()
    await expect(page.getByTestId('transition-Livré')).toBeVisible()
    await expect(page.getByTestId('transition-Appeler')).toHaveCount(0)

    await page.getByTestId('select-mode-transitions').selectOption({ label: 'Envoi par E-mail' })
    await expect(page.getByTestId('transition-Envoyer par e-mail')).toBeVisible()
    await expect(page.getByTestId('transition-Clôturer')).toBeVisible()
  })

  test('modifie la description d\'un mode', async ({ page }) => {
    const DESC = 'Mode de transmission E2E'
    await page.goto('/workflows')

    await page.getByTestId('edit-mode-Retrait au Secrétariat').click()
    await expect(page.getByRole('heading', { name: 'Modifier le mode' })).toBeVisible()
    const descInput = page.getByPlaceholder('Précision affichée aux agents')
    await descInput.fill(DESC)
    await page.getByTestId('btn-save-entity').click()

    await expect(page.getByTestId('mode-Retrait au Secrétariat')).toContainText(DESC)

    await page.getByTestId('edit-mode-Retrait au Secrétariat').click()
    await page.getByPlaceholder('Précision affichée aux agents').fill('')
    await page.getByTestId('btn-save-entity').click()
    await expect(page.getByTestId('mode-Retrait au Secrétariat')).not.toContainText(DESC)
  })

  test('suppression protégée pour un mode utilisé', async ({ page }) => {
    await page.goto('/workflows')
    await page.getByTestId('delete-mode-Retrait au Secrétariat').click()
    const dialog = page.locator('.bg-black\\/40').filter({ hasText: 'Supprimer « Retrait au Secrétariat » ?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await expect(page.getByText(/Impossible de supprimer/)).toBeVisible()
    await expect(page.getByTestId('mode-Retrait au Secrétariat')).toBeVisible()
  })
})
