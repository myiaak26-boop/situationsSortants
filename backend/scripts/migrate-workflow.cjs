// Migration one-shot : ajoute le moteur de workflow par mode de transmission
// sur une base existante. Idempotent.
const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^file:/, '')
  : path.resolve(__dirname, '..', 'dev.db')

const db = new Database(DB_PATH)
const hasColumn = (table, column) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  return cols.some((c) => c.name === column)
}

const hasTable = (table) => {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table)
  return !!t
}

console.log(`Migration workflow — base : ${DB_PATH}`)

if (!hasTable('ModeTransmission')) {
  db.exec(`
    CREATE TABLE "ModeTransmission" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "nom" TEXT NOT NULL,
      "description" TEXT,
      "couleur" TEXT NOT NULL DEFAULT '#6B7280',
      "icone" TEXT,
      "cle" TEXT,
      "ordre" INTEGER NOT NULL DEFAULT 0,
      "actif" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "ModeTransmission_nom_key" ON "ModeTransmission"("nom");
  `)
  console.log('  Table ModeTransmission créée')
}

const MODES = [
  {
    id: 'mode-retrait',
    nom: 'Retrait au Secrétariat',
    description: 'Le destinataire est appelé, puis le courrier est retiré au secrétariat.',
    couleur: '#3B82F6',
    icone: 'Phone',
    cle: 'RETRAIT',
    ordre: 0,
  },
  {
    id: 'mode-email',
    nom: 'Envoi par E-mail',
    description: 'Le courrier est envoyé par e-mail puis clôturé.',
    couleur: '#8B5CF6',
    icone: 'Mail',
    cle: 'MAIL',
    ordre: 1,
  },
  {
    id: 'mode-coursier',
    nom: 'Remise au Coursier',
    description: 'Le courrier est transmis à un coursier puis livré.',
    couleur: '#F59E0B',
    icone: 'Truck',
    cle: 'COURSIER',
    ordre: 2,
  },
]

const insertMode = db.prepare(
  'INSERT OR IGNORE INTO ModeTransmission (id, nom, description, couleur, icone, cle, ordre, actif) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
)
for (const m of MODES) {
  insertMode.run(m.id, m.nom, m.description, m.couleur, m.icone, m.cle, m.ordre)
  console.log(`  Mode « ${m.nom} » présent`)
}

if (!hasColumn('Transition', 'modeTransmissionId')) {
  db.exec('ALTER TABLE "Transition" ADD COLUMN "modeTransmissionId" TEXT')
  console.log('  Colonne Transition.modeTransmissionId ajoutée')
}
if (!hasColumn('Transition', 'estRappel')) {
  db.exec('ALTER TABLE "Transition" ADD COLUMN "estRappel" BOOLEAN NOT NULL DEFAULT false')
  console.log('  Colonne Transition.estRappel ajoutée')
}
if (!hasColumn('Courrier', 'modeTransmissionId')) {
  db.exec('ALTER TABLE "Courrier" ADD COLUMN "modeTransmissionId" TEXT')
  console.log('  Colonne Courrier.modeTransmissionId ajoutée')
}

// Rétro-affectation : les anciennes transitions et courriers appartiennent au mode « Retrait au Secrétariat »
const retro = db.prepare(
  "UPDATE Transition SET modeTransmissionId = 'mode-retrait' WHERE modeTransmissionId IS NULL",
).run()
console.log(`  Transitions rattachées au mode Retrait : ${retro.changes}`)

const retroRappel = db.prepare(
  "UPDATE Transition SET estRappel = 1 WHERE nom LIKE '%Rappel%' OR nom LIKE '%rappel%'",
).run()
console.log(`  Transitions de rappel marquées : ${retroRappel.changes}`)

const retroCourriers = db.prepare(
  "UPDATE Courrier SET modeTransmissionId = 'mode-retrait' WHERE modeTransmissionId IS NULL",
).run()
console.log(`  Courriers rattachés au mode Retrait : ${retroCourriers.changes}`)

// Synchronise modeEnvoi hérité (MAIL / COURSIER) pour les filtres de la page Situations
const syncMail = db.prepare(
  "UPDATE Courrier SET modeEnvoi = 'MAIL' WHERE modeTransmissionId = 'mode-email' AND modeEnvoi IS NULL",
).run()
const syncCoursier = db.prepare(
  "UPDATE Courrier SET modeEnvoi = 'COURSIER' WHERE modeTransmissionId = 'mode-coursier' AND modeEnvoi IS NULL",
).run()
const syncRetrait = db.prepare(
  "UPDATE Courrier SET modeEnvoi = 'RETRAIT' WHERE modeTransmissionId = 'mode-retrait' AND modeEnvoi IS NULL",
).run()
console.log(`  modeEnvoi synchronisé : MAIL=${syncMail.changes} COURSIER=${syncCoursier.changes} RETRAIT=${syncRetrait.changes}`)

db.close()
console.log('Migration terminée ✅')
