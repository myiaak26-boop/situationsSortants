import { test, expect, type Page, type Locator } from '@playwright/test'
import Database from 'better-sqlite3'
import path from 'node:path'

const DB_PATH = path.resolve(process.cwd(), '../backend/dev.db')
const DAY = 86400000
let db: Database.Database

const NUMEROS = {
  v1: 'E2E-001', // déli 3j → vert
  v2: 'E2E-002', // déli 5j → orange
  v3: 'E2E-003', // déli 10j → rouge
  v4: 'E2E-004', // retiré, déli 1j → vert, réponse R-2026-001, objet long
  v5: 'E2E-005', // déli 0j → vert, objet "rapport annuel"
  v6: 'E2E-006', // déli 20j → rouge, réponse R-2026-099
}

const LONG_OBJET =
  'Accusé de réception du dossier complet transmis par le service technique pour validation interne du secrétariat'

function sitId(nom: string): string {
  return (db.prepare('SELECT id FROM Situation WHERE nom = ?').get(nom) as { id: string }).id
}

function modeId(nom: string): string {
  return (db.prepare('SELECT id FROM ModeTransmission WHERE nom = ?').get(nom) as { id: string }).id
}

function seed() {
  const user = (db.prepare("SELECT id FROM User WHERE email = 'admin@dex.local'").get() as { id: string }).id
  db.prepare("DELETE FROM Retrait WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'E2E-%')").run()
  db.prepare("DELETE FROM Courrier WHERE numero LIKE 'E2E-%'").run()

  const now = Date.now()
  const iso = (t: number) => new Date(t).toISOString()
  const insert = db.prepare(
    `INSERT INTO Courrier (id, numero, dateEnvoi, destinataire, objet, signataire, numeroEntrant, situationId, modeTransmissionId, createdById, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertRetrait = db.prepare(
    `INSERT INTO Retrait (id, courrierId, nomRetraitant, telephone, observation, retireParId, dateRetrait)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  const rows: [string, string, number, string, string, string, string | null, string][] = [
    ['001', NUMEROS.v1, now - 3 * DAY, 'Société Test Alpha', 'Accusé de réception du dossier', 'PDG', null, 'Nouveau'],
    ['002', NUMEROS.v2, now - 5 * DAY, 'Banque Test Congo', 'Demande de confirmation bancaire', 'PDG', null, 'Destinataire joint'],
    ['003', NUMEROS.v3, now - 10 * DAY, 'Ministère Test', 'Transmission de la note de service', 'DG', null, 'Injoignable'],
    ['004', NUMEROS.v4, now - 2 * DAY, 'Hôpital Régional', LONG_OBJET, 'SG', 'R-2026-001', 'Retiré'],
    ['005', NUMEROS.v5, now, 'Mairie de Pointe-Noire', 'Transmission du rapport annuel', 'DG', null, 'Nouveau'],
    ['006', NUMEROS.v6, now - 20 * DAY, 'Préfecture Test', 'Demande de renseignements', 'PDG', 'R-2026-099', 'Nouveau'],
  ]

  const retraitMode = modeId('Retrait au Secrétariat')

  for (const [id, numero, dateEnvoi, destinataire, objet, signataire, reponse, situation] of rows) {
    insert.run(
      `e2e-${id}-${now}`,
      numero,
      iso(dateEnvoi),
      destinataire,
      objet,
      signataire,
      reponse,
      sitId(situation),
      retraitMode,
      user,
      iso(now),
      iso(now),
    )
  }

  insertRetrait.run(`e2e-ret-${now}`, `e2e-004-${now}`, 'Retraitant E2E', null, null, user, iso(now - DAY))
}

function cleanup() {
  db.prepare("DELETE FROM Retrait WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'E2E-%')").run()
  db.prepare("DELETE FROM Courrier WHERE numero LIKE 'E2E-%'").run()
}

test.beforeAll(() => {
  db = new Database(DB_PATH)
  seed()
})

test.afterAll(() => {
  cleanup()
  db.close()
})

async function search(page: Page, q: string) {
  await page.getByTestId('search-global').fill(q)
}

async function waitResults(page: Page, n: number) {
  await expect(page.getByTestId('pagination-info')).toContainText(`sur ${n}`)
}

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 768
}

/** Ligne du tableau (desktop/tablette) ou carte (mobile) d'un courrier donné */
function row(page: Page, numero: string): Locator {
  return isMobile(page)
    ? page.locator('[data-testid="courrier-card"]', { hasText: numero })
    : page.getByTestId(`row-${numero}`)
}

function firstRow(page: Page): Locator {
  return isMobile(page) ? page.locator('[data-testid="courrier-card"]').first() : page.locator('tbody tr').first()
}

test.describe('Liste des courriers sortants', () => {
  test('affiche le tableau avec les colonnes attendues', async ({ page }) => {
    await page.goto('/courriers')
    await expect(page.getByRole('heading', { name: 'Courriers sortants' })).toBeVisible()
    await search(page, NUMEROS.v1)
    const r = row(page, NUMEROS.v1)
    await expect(r).toBeVisible()
    await expect(r).toContainText('Nouveau')
    await expect(r).toContainText(/\d{2}\/\d{2}\/\d{4}/)
  })

  test('affiche un tiret pour les champs vides', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, NUMEROS.v1)
    const r = row(page, NUMEROS.v1)
    await expect(r).toBeVisible()
    await expect(r.getByText('-').first()).toBeVisible()
  })

  test('recherche par numéro', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-003')
    await expect(row(page, NUMEROS.v3)).toBeVisible()
    await expect(row(page, NUMEROS.v1)).toHaveCount(0)
  })

  test('recherche par destinataire', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'Société Test Alpha')
    await expect(row(page, NUMEROS.v1)).toBeVisible()
    await expect(row(page, NUMEROS.v3)).toHaveCount(0)
  })

  test('recherche par objet', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'rapport annuel')
    await expect(row(page, NUMEROS.v5)).toBeVisible()
  })

  test('recherche par numéro de réponse', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'R-2026-099')
    await expect(row(page, NUMEROS.v6)).toBeVisible()
  })

  test('filtre par situation', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await page.getByTestId('filter-situation').selectOption({ label: 'Retiré' })
    await expect(row(page, NUMEROS.v4)).toBeVisible()
    await expect(row(page, NUMEROS.v1)).toHaveCount(0)
  })

  test('filtre par signataire', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await page.getByTestId('filter-signataire').selectOption({ label: 'DG' })
    await expect(row(page, NUMEROS.v3)).toBeVisible()
    await expect(row(page, NUMEROS.v5)).toBeVisible()
    await expect(row(page, NUMEROS.v1)).toHaveCount(0)
  })

  test('filtre par période', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    const d5 = new Date(Date.now() - 5 * DAY).toLocaleDateString('en-CA')
    await page.getByTestId('filter-date-debut').fill(d5)
    await page.getByTestId('filter-date-fin').fill(d5)
    await expect(row(page, NUMEROS.v2)).toBeVisible()
    await expect(row(page, NUMEROS.v1)).toHaveCount(0)
  })

  test('réinitialisation des filtres', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await page.getByTestId('filter-situation').selectOption({ label: 'Retiré' })
    await expect(row(page, NUMEROS.v4)).toBeVisible()
    await page.getByTestId('btn-reset-filters').click()
    await expect(page.getByTestId('filter-situation')).toHaveValue('')
    await expect(row(page, NUMEROS.v1)).toBeVisible()
  })

  test('tri par numéro croissant puis décroissant', async ({ page }) => {
    test.skip(isMobile(page), 'tri disponible seulement sur table (mobile = cartes)')
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await expect(page.getByTestId('search-global')).toHaveValue('E2E-')
    await page.getByTestId('sort-numero').click()
    await expect(firstRow(page)).toContainText(NUMEROS.v1)
    await page.getByTestId('sort-numero').click()
    await expect(firstRow(page)).toContainText(NUMEROS.v6)
  })

  test("tri par date d'envoi croissant", async ({ page }) => {
    test.skip(isMobile(page), 'tri disponible seulement sur table (mobile = cartes)')
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await expect(page.getByTestId('search-global')).toHaveValue('E2E-')
    await page.getByTestId('sort-dateEnvoi').click()
    await expect(firstRow(page)).toContainText(NUMEROS.v6)
  })

  test('date de retrait affichée au format JJ/MM/AAAA HH:mm', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, NUMEROS.v4)
    const r = row(page, NUMEROS.v4)
    await expect(r).toBeVisible()
    if (isMobile(page)) {
      await expect(r).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
    } else {
      await expect(r.getByTestId('cell-date-retrait')).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
    }
  })

  test('réponse au courrier affichée', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, NUMEROS.v4)
    await expect(row(page, NUMEROS.v4)).toContainText('R-2026-001')
  })

  test("tooltip affiche l'objet complet au survol", async ({ page }) => {
    test.skip(isMobile(page), 'tooltip réservé à l\'affichage tableau (mobile = texte complet)')
    await page.goto('/courriers')
    await search(page, NUMEROS.v4)
    const cell = page.getByTestId(`row-${NUMEROS.v4}`).getByTestId('objet-cell')
    await cell.hover()
    await expect(page.getByTestId('objet-tooltip-content').filter({ hasText: LONG_OBJET }).first()).toBeVisible()
  })

  test('pagination : taille de page et navigation', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await waitResults(page, 6)
    await expect(page.getByTestId('pagination-info')).toContainText('sur 6')

    await page.getByTestId('page-size').selectOption('50')
    await expect(page.getByTestId('pagination-info')).toContainText('sur 6')
    await expect(page.getByTestId('page-next')).toHaveCount(0)

    await page.goto('/courriers')
    await expect(page.getByTestId('pagination-info')).toContainText(/sur \d+/)
    await expect(page.getByText(/Page 1 sur \d+/)).toBeVisible()
    await page.getByTestId('page-next').click()
    await expect(page.getByText(/Page 2 sur \d+/)).toBeVisible()
  })

  test('bouton actualiser recharge les données', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, NUMEROS.v1)
    await expect(row(page, NUMEROS.v1)).toBeVisible()
    await page.getByTestId('btn-refresh').click()
    await expect(row(page, NUMEROS.v1)).toBeVisible()
  })

  test('export CSV', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'E2E-')
    await expect(page.getByTestId('pagination-info')).toContainText('sur 6')
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('btn-export').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^courriers-sortants-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test('état vide global', async ({ page }) => {
    await page.route('**/api/courriers*', async (route) => {
      const url = route.request().url()
      if (url.includes('/meta')) return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }),
      })
    })
    await page.goto('/courriers')
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByText('Aucun courrier disponible.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importer un fichier Excel' })).toBeVisible()
  })

  test('aucun résultat : message et réinitialisation', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, 'zzz-inexistant-xyz')
    await expect(page.getByTestId('empty-no-results')).toBeVisible()
    await expect(page.getByText('Aucun courrier ne correspond à vos critères')).toBeVisible()
    await page.getByTestId('btn-empty-reset').click()
    await expect(page.getByTestId('search-global')).toHaveValue('')
  })

  test('responsive : colonnes masquées / cartes mobiles', async ({ page }) => {
    await page.goto('/courriers')
    await search(page, NUMEROS.v1)
    const r = row(page, NUMEROS.v1)
    await expect(r).toBeVisible()
    const width = page.viewportSize()?.width ?? 0
    if (width >= 768 && width < 1024) {
      await expect(page.locator('thead').getByText('Date de retrait')).toBeHidden()
      await expect(page.locator('thead').getByText('Signataire')).toBeHidden()
      await expect(page.getByTestId(`row-${NUMEROS.v1}`)).toBeVisible()
    } else if (width < 768) {
      await expect(page.locator('[data-testid="courrier-card"]').first()).toBeVisible()
      await expect(page.locator('table')).toBeHidden()
    } else {
      await expect(page.locator('thead').getByText('Date de retrait')).toBeVisible()
      await expect(page.locator('thead').getByText('Signataire')).toBeVisible()
    }
  })
})
