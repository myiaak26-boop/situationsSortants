// Fix #2 — Migration des données : le statut « E-mail envoyé » est un mode de
// transmission déguisé en statut de suivi. Il est purgé :
//   1. courriers au statut « E-mail envoyé » → statut « Livré »
//   2. si modeTransmissionId manquant → « Envoi par E-mail » + modeEnvoi = MAIL
//   3. historique + transitions pointant vers ce statut → re-pointés / supprimés
//   4. suppression de la ligne Situation « E-mail envoyé »
// Idempotent : peut être relancé sans risque.
const Database = require('C:/Users/HP/Desktop/dex/node_modules/better-sqlite3')
const path = process.env.DEX_DB || 'C:/Users/HP/Desktop/dex/backend/dev.db'

const db = new Database(path)
const q = (sql, ...args) => db.prepare(sql).get(...args)
const run = (sql, ...args) => db.prepare(sql).run(...args)

const mailSit = q("SELECT id, nom FROM Situation WHERE lower(nom) LIKE '%mail%'")
if (!mailSit) {
  console.log('Aucun statut « E-mail envoyé » trouvé — rien à faire.')
  process.exit(0)
}

const livre = q("SELECT id FROM Situation WHERE nom = 'Livré'")
const modeMail = q("SELECT id FROM ModeTransmission WHERE lower(nom) LIKE '%mail%'")
if (!livre || !modeMail) {
  console.error('Introuvable : statut Livré =', !!livre, '| mode Envoi par E-mail =', !!modeMail)
  process.exit(1)
}

const avant = q('SELECT COUNT(*) AS n FROM Courrier WHERE situationId = ?', mailSit.id).n

db.transaction(() => {
  // 1. Courriers → Livré + mode e-mail (si vide)
  run(
    'UPDATE Courrier SET situationId = ?, modeTransmissionId = COALESCE(modeTransmissionId, ?), modeEnvoi = COALESCE(modeEnvoi, ?) WHERE situationId = ?',
    livre.id, modeMail.id, 'MAIL', mailSit.id,
  )
  // 2. Historique : re-pointer les références vers le statut Livré
  run('UPDATE HistoriqueAction SET fromSituationId = ? WHERE fromSituationId = ?', livre.id, mailSit.id)
  run('UPDATE HistoriqueAction SET toSituationId = ? WHERE toSituationId = ?', livre.id, mailSit.id)
  // 3. Transitions qui menaient à ce statut
  run('DELETE FROM Transition WHERE fromSituationId = ? OR toSituationId = ?', mailSit.id, mailSit.id)
  // 4. Purge du statut parasite
  run('DELETE FROM Situation WHERE id = ?', mailSit.id)
})()
db.close()

console.log(`Migration terminée : ${avant} courrier(s) « E-mail envoyé » → « Livré » + mode e-mail.`)
