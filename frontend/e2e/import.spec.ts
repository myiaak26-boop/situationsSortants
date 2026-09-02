import { test, expect, request, type Page, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

// -----------------------------------------------------------------------------
// Suite de tests du nouveau format d'import Excel « Liste des courriers
// sortants normaux ». S'appuie sur le wizard d'importation existant et vérifie
// les données réellement enregistrées en base via l'API backend.
// -----------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_DIR = path.resolve(__dirname, '..', '..', 'test')
const REAL_FILE = path.join(TEST_DIR, 'Liste des courriers sortants normaux (11).xlsx')
const FIXTURE_A = path.join(TEST_DIR, 'fixture-a-nouveau.xlsx') // 9801-26…9805-26
const FIXTURE_B = path.join(TEST_DIR, 'fixture-b-nouveau.xlsx') // 9901-26…9903-26

const API = 'http://localhost:3000'
const FIXTURE_PREFIXES = ['9801-26', '9802-26', '9803-26', '9804-26', '9805-26', '9901-26', '9902-26', '9903-26']

test.describe('Import Excel — nouveau format', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(300_000)

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Suite d’import exécutée sur desktop uniquement')
  })

  async function login(): Promise<string> {
    const ctx = await request.newContext({ baseURL: API })
    const res = await ctx.post('/api/auth/login', {
      data: {
        email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local',
        password: process.env.DEX_ADMIN_PASSWORD || 'admin123',
      },
    })
    if (!res.ok()) throw new Error(`Login → ${res.status()}`)
    const t = ((await res.json()) as { token: string }).token
    await ctx.dispose()
    return t
  }

  async function api(): Promise<APIRequestContext> {
    const t = await login()
    return request.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${t}` },
    })
  }

  /** Soft-delete direct SQL des fixtures (le pooler Supabase est trop lent pour 8 recherches API). */
  async function cleanupFixtureSQL() {
    const envPath = path.resolve(__dirname, '..', '..', 'backend', '.env')
    const env = fs.readFileSync(envPath, 'utf8')
    const url = env.match(/DATABASE_URL="([^"]+)"/)?.[1]
    if (!url) throw new Error('DATABASE_URL introuvable dans backend/.env')
    const pg = await import('pg')
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    const nums = FIXTURE_PREFIXES.map((p) => `numero like '${p}'`).join(' or ')
    await client.query(`update "Courrier" set "deletedAt" = now() where ${nums}`)
    await client.end()
  }

  async function getCourrier(ctx: APIRequestContext, numero: string) {
    const r = await ctx.get('/api/courriers', { params: { search: numero, pageSize: '50' } })
    expect(r.ok()).toBeTruthy()
    const data = (await r.json()) as Array<{ numero: string; id: string; signataire: string; signataireId: string | null; numeroEntrant: string | null; dureeTraitement: number | null; situationId: string }>
    return data.find((c) => c.numero === numero)
  }

  /** Clique sur le bouton « Continuer » une fois qu'il est actif. */
  async function continueWhenReady(page: Page) {
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Continuer' }).click()
  }

  /** Pilote le wizard : upload → feuille → aperçu → colonnes → validation → import. */
  async function runImport(page: Page, filePath: string, policy: 'ignore' | 'update' = 'ignore') {
    await page.goto('/import')
    await page.setInputFiles('input[type="file"]', filePath)

    await expect(page.getByRole('heading', { name: 'Choix de la feuille' })).toBeVisible()
    await continueWhenReady(page)

    await expect(page.getByRole('heading', { name: 'Prévisualisation' })).toBeVisible()
    await continueWhenReady(page)

    await expect(page.getByRole('heading', { name: 'Correspondance des colonnes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Valider les données' })).toBeEnabled()
    await page.getByRole('button', { name: 'Valider les données' }).click()

    await expect(page.getByRole('heading', { name: 'Validation' })).toBeVisible()

    if (policy === 'update') {
      await page.getByRole('button', { name: /Mettre à jour/ }).click()
    }

    await expect(page.getByRole('button', { name: /^Importer/ })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: /^Importer/ }).click()

    await expect(page.getByRole('heading', { name: 'Importation' })).toBeVisible()
    await expect(page.getByText('Importation terminée')).toBeVisible({ timeout: 240_000 })
  }

  /** Pilote le wizard jusqu'à l'étape « Correspondance des colonnes ». */
  async function runToMapping(page: Page, filePath: string) {
    await page.goto('/import')
    await page.setInputFiles('input[type="file"]', filePath)

    await expect(page.getByRole('heading', { name: 'Choix de la feuille' })).toBeVisible()
    await continueWhenReady(page)

    await expect(page.getByRole('heading', { name: 'Prévisualisation' })).toBeVisible()
    await continueWhenReady(page)

    await expect(page.getByRole('heading', { name: 'Correspondance des colonnes' })).toBeVisible()
  }

  test.beforeAll(async () => {
    await cleanupFixtureSQL()
  })

  test.afterAll(async () => {
    await cleanupFixtureSQL()
  })

  test('TEST 1 — Importe le nouveau fichier réel via le wizard', async ({ page }) => {
    await runImport(page, REAL_FILE, 'ignore')
    const ctx = await api()
    // Le fichier (11) a déjà été importé : 0 nouveau, tous EXISTANT. Aucun doublon créé.
    const c0160 = await getCourrier(ctx, '0160-26')
    expect(c0160).toBeDefined()
    await ctx.dispose()
  })

  test('TEST 2 — Les 10 colonnes du nouveau format sont reconnues automatiquement', async ({ page }) => {
    await runToMapping(page, REAL_FILE)
    const expected: Record<string, string> = {
      numero: 'Numéro',
      dateEnvoi: 'Date de signature',
      destinataire: 'Nom destinataire',
      objet: 'Objet',
      signataire: 'Signataire',
      nombrePages: 'Nombre de Page',
      numeroEntrant: "Numéro du courrier à l'arrivée",
      dureeTraitement: 'Durée de traitement',
      dateObservation: "Date d'Observation",
    }
    for (const [field, col] of Object.entries(expected)) {
      await expect(page.getByTestId(`mapping-${field}`)).toHaveValue(col)
    }
    // Le champ « # » (rang technique) ne doit être mappé sur aucun champ métier
    await expect(page.getByTestId('mapping-numero')).not.toHaveValue('#')
  })

  test('TEST 3 — Le courrier 0160-26 est importé avec le champ « Numéro » (et non « # »)', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '0160-26')
    expect(c).toBeDefined()
    expect(c!.numero).toBe('0160-26')
    expect(c!.numero).not.toBe('1')
    expect(c!.numero).not.toBe('#')
    await ctx.dispose()
  })

  test('TEST 4 — Le signataire « Premier Ministre » est mappé vers « PM »', async ({ page }) => {
    await runImport(page, FIXTURE_A, 'ignore')
    const ctx = await api()
    const c = await getCourrier(ctx, '9801-26')
    expect(c).toBeDefined()
    expect(c!.signataire).toBe('PM')
    expect(c!.signataireId).not.toBeNull()
    await ctx.dispose()
  })

  test('TEST 5 — Un courrier avec « Numéro du courrier à l’arrivée » est un courrier réponse', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '9802-26')
    expect(c).toBeDefined()
    expect(c!.numeroEntrant).toBe('3170-26')
    await ctx.dispose()
  })

  test('TEST 6 — Un courrier sans référence est un courrier simple', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '9801-26')
    expect(c).toBeDefined()
    expect(c!.numeroEntrant).toBeNull()
    await ctx.dispose()
  })

  test('TEST 7 — La « Durée de traitement » est bien importée (normalisée en jours)', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '9803-26')
    expect(c).toBeDefined()
    // « 6 Jrs 20 h 26 min » → 6 + 20/24 + 26/1440 ≈ 6,8514 jours (nombre, pas texte)
    expect(typeof c!.dureeTraitement).toBe('number')
    expect(c!.dureeTraitement).toBeCloseTo(6.8514, 3)
    await ctx.dispose()
  })

  test('TEST 11 — La durée du fichier réel (1336-26) est importée comme nombre de jours', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '1336-26')
    expect(c).toBeDefined()
    expect(typeof c!.dureeTraitement).toBe('number')
    expect(c!.dureeTraitement).toBeCloseTo(6.8514, 3)
    await ctx.dispose()
  })

  test('TEST 12 — La durée est affichée sur la fiche du courrier', async ({ page }) => {
    const ctx = await api()
    const c = await getCourrier(ctx, '1336-26')
    expect(c).toBeDefined()
    await page.goto(`/courriers/${c!.id}/fiche`)
    await expect(page.getByText('Durée de traitement')).toBeVisible()
    await expect(page.getByText('6 j 20 h 26 min')).toBeVisible()
    await ctx.dispose()
  })

  test('TEST 13 — La durée importée alimente les statistiques de délais et le rapport', async () => {
    const ctx = await api()
    const c = await getCourrier(ctx, '1336-26')
    expect(c).toBeDefined()
    const dateEnvoi = (await (await ctx.get(`/api/courriers/${c!.id}`)).json() as { dateEnvoi: string }).dateEnvoi
    const jour = dateEnvoi.slice(0, 10)
    const jourSuivant = new Date(new Date(`${jour}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10)

    // Statistiques (répartition 4-7 j : 6,85 j → tranche « 4-7 j »)
    const stats = await ctx.get('/api/situations/requete', {
      params: { periode: 'personnalisee', dateDebut: jour, dateFin: jourSuivant, pageSize: '200' },
    })
    expect(stats.ok()).toBeTruthy()
    const body = (await stats.json()) as {
      stats: { delaiMinJours: number | null; repartitionDelais: { libelle: string; count: number }[] }
    }
    const tranche47 = body.stats.repartitionDelais.find((t) => t.libelle === '4-7 j')
    expect(tranche47).toBeDefined()
    expect(tranche47!.count).toBeGreaterThanOrEqual(1)
    expect(body.stats.delaiMinJours).toBe(6)

    // Rapport Excel : tableau détaillé + feuille Délais
    const exp = await ctx.get('/api/situations/export/exec-xlsx', {
      params: { periode: 'personnalisee', dateDebut: jour, dateFin: jourSuivant, reportType: 'generale' },
    })
    expect(exp.ok()).toBeTruthy()
    const wb = XLSX.read(Buffer.from(await exp.body()))
    const complet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Situation complète'], { defval: '' })
    const ligne = complet.find((r) => String(r['N°']).includes('1336-26'))
    expect(ligne).toBeDefined()
    expect(String(ligne!['Durée de traitement']).replace('.', ',')).toBe('6,9')
    const delais = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Délais'], { defval: '' })
    const ligne47 = delais.find((r) => String(r['Tranche']) === '4-7 j')
    expect(ligne47).toBeDefined()
    expect(Number(ligne47!['Courriers'])).toBeGreaterThanOrEqual(1)
    await ctx.dispose()
  })

  test('TEST 8 — Importer deux fois le même fichier ne crée pas de doublons', async ({ page }) => {
    await runImport(page, FIXTURE_A, 'ignore')
    await runImport(page, FIXTURE_A, 'ignore')
    const ctx = await api()
    const r = await ctx.get('/api/courriers', { params: { search: '9801-26', pageSize: '100' } })
    expect(r.ok()).toBeTruthy()
    const matches = ((await r.json()) as Array<{ numero: string }>).filter((x) => x.numero === '9801-26')
    expect(matches.length).toBe(1)
    await ctx.dispose()
  })

  test('TEST 9 — Importer un second fichier n’écrase pas les courriers existants', async ({ page }) => {
    await runImport(page, FIXTURE_A, 'ignore')
    await runImport(page, FIXTURE_B, 'ignore')
    const ctx = await api()
    const a = await getCourrier(ctx, '9801-26')
    const b = await getCourrier(ctx, '9901-26')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    await ctx.dispose()
  })

  test('TEST 10 — Un courrier existant ne perd aucun événement de suivi après ré-import', async ({ page }) => {
    await runImport(page, FIXTURE_A, 'update')
    const ctx = await api()

    const c = await getCourrier(ctx, '9801-26')
    expect(c).toBeDefined()
    const before = await ctx.get(`/api/courriers/${c!.id}`)
    const beforeData = (await before.json()) as { situationId: string; retrait: unknown; historiqueActions: unknown[]; dureeTraitement: number | null }
    const histBefore = beforeData.historiqueActions.length

    // Ré-import avec policy update : ni situation, ni historique, ni durée ne doivent être écrasés
    await runImport(page, FIXTURE_A, 'update')

    const after = await ctx.get(`/api/courriers/${c!.id}`)
    const afterData = (await after.json()) as { situationId: string; retrait: unknown; historiqueActions: unknown[]; dureeTraitement: number | null }
    expect(afterData.situationId).toBe(beforeData.situationId)
    expect(afterData.retrait).toEqual(beforeData.retrait)
    expect(afterData.historiqueActions.length).toBeGreaterThanOrEqual(histBefore)
    await ctx.dispose()
  })
})