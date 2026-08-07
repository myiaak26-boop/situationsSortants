import { test, expect } from '@playwright/test'
import Database from 'better-sqlite3'
import path from 'node:path'

const DB_PATH = path.resolve(process.cwd(), '../backend/dev.db')
let db: Database.Database

const IDs: Record<string, string> = {}

function sitId(nom: string): string {
  return (db.prepare('SELECT id FROM Situation WHERE nom = ?').get(nom) as { id: string }).id
}

function modeId(nom: string): string {
  return (db.prepare('SELECT id FROM ModeTransmission WHERE nom = ?').get(nom) as { id: string }).id
}

function seed() {
  const user = (db.prepare("SELECT id FROM User WHERE email = 'admin@dex.local'").get() as { id: string }).id
  db.prepare("DELETE FROM HistoriqueAction WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'WF-%')").run()
  db.prepare("DELETE FROM Retrait WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'WF-%')").run()
  db.prepare("DELETE FROM Courrier WHERE numero LIKE 'WF-%'").run()

  const now = Date.now()
  const iso = (t: number) => new Date(t).toISOString()
  const insert = db.prepare(
    `INSERT INTO Courrier (id, numero, dateEnvoi, destinataire, objet, signataire, numeroEntrant, situationId, modeTransmissionId, createdById, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
  )

  const rows: [string, string, string, string][] = [
    ['ret-attente', 'WF-RET-1', 'Retrait au Secrétariat', 'En attente de retrait'],
    ['ret-injoignable', 'WF-RET-2', 'Retrait au Secrétariat', 'Injoignable'],
    ['ret-final', 'WF-RET-3', 'Retrait au Secrétariat', 'Retiré'],
    ['mail-nouveau', 'WF-MAIL-1', 'Envoi par E-mail', 'Nouveau'],
    ['cour-nouveau', 'WF-COUR-1', 'Remise au Coursier', 'Nouveau'],
    ['cour-historique', 'WF-COUR-2', 'Remise au Coursier', 'Nouveau'],
  ]

  for (const [key, numero, mode, situation] of rows) {
    const id = `wf-${key}-${now}`
    IDs[key] = id
    insert.run(id, numero, iso(now - 5 * 86400000), 'Destinataire E2E', `Objet ${numero}`, 'Signataire E2E', sitId(situation), modeId(mode), user, iso(now), iso(now))
  }
}

function cleanup() {
  db.prepare("DELETE FROM HistoriqueAction WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'WF-%')").run()
  db.prepare("DELETE FROM Retrait WHERE courrierId IN (SELECT id FROM Courrier WHERE numero LIKE 'WF-%')").run()
  db.prepare("DELETE FROM Courrier WHERE numero LIKE 'WF-%'").run()
}

test.beforeAll(() => {
  db = new Database(DB_PATH)
  seed()
})

test.afterAll(() => {
  cleanup()
  db.close()
})

test.describe('Workflow dynamique', () => {
  test('boutons limités au mode du courrier (E-mail)', async ({ page }) => {
    await page.goto(`/courriers/${IDs['mail-nouveau']}`)
    await expect(page.getByTestId('detail-badge-mode')).toContainText('Envoi par E-mail')
    await expect(page.getByTestId('btn-transition-Envoyer par e-mail')).toBeVisible()
    await expect(page.getByTestId('btn-transition-Appeler')).toHaveCount(0)
    await expect(page.getByTestId('btn-transition-Retiré')).toHaveCount(0)
  })

  test('boutons limités au mode du courrier (Coursier)', async ({ page }) => {
    await page.goto(`/courriers/${IDs['cour-nouveau']}`)
    await expect(page.getByTestId('detail-badge-mode')).toContainText('Remise au Coursier')
    await expect(page.getByTestId('btn-transition-Transmettre au coursier')).toBeVisible()
    await expect(page.getByTestId('btn-transition-Envoyer par e-mail')).toHaveCount(0)
  })

  test('transition simple sans formulaire', async ({ page }) => {
    await page.goto(`/courriers/${IDs['cour-nouveau']}`)
    await page.getByTestId('btn-transition-Transmettre au coursier').click()
    await expect(page.getByText('Auprès du coursier')).toBeVisible()
    await expect(page.getByTestId('btn-transition-Livré')).toBeVisible()
    await expect(page.getByTestId('btn-transition-Transmettre au coursier')).toHaveCount(0)
  })

  test('retrait : formulaire obligatoire puis situation finale', async ({ page }) => {
    await page.goto(`/courriers/${IDs['ret-attente']}`)
    await expect(page.getByTestId('btn-transition-Retiré')).toBeVisible()

    await page.getByTestId('btn-transition-Retiré').click()
    await expect(page.getByTestId('retrait-dialog')).toBeVisible()

    await expect(page.getByTestId('btn-confirmer-retrait')).toBeDisabled()

    await page.getByTestId('retrait-nom').fill('Jean E2E')
    await page.getByTestId('retrait-tel').fill('+242 06 123 45 67')
    await page.getByTestId('retrait-obs').fill('Retrait effectué en main propre')
    await page.getByTestId('btn-confirmer-retrait').click()

    const card = page.getByTestId('retrait-card')
    await expect(card.getByText('Retiré par', { exact: true })).toBeVisible()
    await expect(card.getByText('Jean E2E')).toBeVisible()
    await expect(card.getByText('+242 06 123 45 67')).toBeVisible()
    await expect(card.getByText('Retrait effectué en main propre')).toBeVisible()
    await expect(page.getByText('Situation finale')).toBeVisible()
    await expect(page.getByTestId('btn-transition-Retiré')).toHaveCount(0)
    await expect(page.getByText('Actions disponibles')).toHaveCount(0)
  })

  test('rappel : incrémente le compteur et journalise', async ({ page }) => {
    await page.goto(`/courriers/${IDs['ret-injoignable']}`)
    await expect(page.getByTestId('btn-transition-Rappeler')).toBeVisible()

    await page.getByTestId('btn-transition-Rappeler').click()

    await expect(page.getByTestId('btn-transition-Rappeler')).toHaveCount(0)
    await expect(page.getByText('Appel effectué')).toBeVisible()
    await expect(page.getByText('Rappeler').first()).toBeVisible()

    const row = db.prepare('SELECT nbrRappels FROM Courrier WHERE id = ?').get(IDs['ret-injoignable']) as { nbrRappels: number }
    expect(row.nbrRappels).toBe(1)
  })

  test('aucune action sur une situation finale', async ({ page }) => {
    await page.goto(`/courriers/${IDs['ret-final']}`)
    await expect(page.getByText('Situation finale')).toBeVisible()
    await expect(page.getByText('Actions disponibles')).toHaveCount(0)
  })

  test('historique retrace les transitions', async ({ page }) => {
    await page.goto(`/courriers/${IDs['cour-historique']}`)
    await page.getByTestId('btn-transition-Transmettre au coursier').click()
    await expect(page.getByTestId('btn-transition-Transmettre au coursier')).toHaveCount(0)
    await expect(page.getByTestId('historique-list').getByText('Transmettre au coursier')).toBeVisible()
  })

  test('création manuelle avec mode obligatoire', async ({ page }) => {
    await page.goto('/courriers/nouveau')
    await expect(page.getByTestId('mode-option-Retrait au Secrétariat')).toBeVisible()
    await page.getByTestId('mode-option-Envoi par E-mail').click()

    const numero = `WF-CREATE-${Date.now()}`
    await page.getByTestId('field-numero').fill(numero)
    await page.getByTestId('field-signataire').fill('Signataire E2E')
    await page.getByTestId('field-destinataire').fill('Destinataire E2E')
    await page.getByTestId('field-objet').fill('Objet création E2E')
    await expect(page.getByTestId('workflow-hint')).toContainText('Envoi par E-mail')

    await page.getByTestId('btn-creer').click()

    await expect(page).toHaveURL(new RegExp('/courriers/'))
    await expect(page.getByTestId('detail-badge-mode')).toContainText('Envoi par E-mail')
    await expect(page.getByTestId('btn-transition-Envoyer par e-mail')).toBeVisible()
  })
})
