const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '..', 'backend', 'dev.db'))

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='RapportLog'").all()
if (tables.length > 0) {
  db.exec('ALTER TABLE "RapportLog" RENAME TO "SituationLog"')
  console.log('Table rename: RapportLog -> SituationLog')
} else {
  console.log('Table RapportLog absente, rien à renommer')
}

const params = db.prepare("SELECT cle FROM Parametre WHERE cle IN ('rapport.institutionNom','rapport.logo')").all()
for (const p of params) {
  const newCle = p.cle.replace('rapport.', 'situation.')
  db.prepare('UPDATE Parametre SET cle = ? WHERE cle = ?').run(newCle, p.cle)
  console.log(`Parametre: ${p.cle} -> ${newCle}`)
}

const roles = db.prepare("SELECT id, permissions FROM Role WHERE permissions LIKE '%rapport%'").all()
for (const r of roles) {
  const updated = r.permissions.replace(/rapport:read/g, 'situation:read').replace(/rapport:export/g, 'situation:export')
  db.prepare('UPDATE Role SET permissions = ? WHERE id = ?').run(updated, r.id)
  console.log(`Role ${r.id}: permissions mises à jour (${r.permissions} -> ${updated})`)
}

db.close()
console.log('Migration DB terminée')
