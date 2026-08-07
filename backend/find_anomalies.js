import Database from 'better-sqlite3';
const db = new Database('./dev.db');

const anomalies = {};

// 1. Desync signataires
anomalies.desyncSignataire = db.prepare(`
  SELECT c.id, c.numero, c.signataire, s.nom as actual_nom
  FROM Courrier c
  JOIN Signataire s ON c.signataireId = s.id
  WHERE c.deletedAt IS NULL AND c.signataire != s.nom
`).all();

// 2. Orphan situations
anomalies.orphanSituation = db.prepare(`
  SELECT id, numero, situationId
  FROM Courrier
  WHERE deletedAt IS NULL AND situationId NOT IN (SELECT id FROM Situation)
`).all();

// 3. Orphan mode
anomalies.orphanMode = db.prepare(`
  SELECT id, numero, modeTransmissionId
  FROM Courrier
  WHERE deletedAt IS NULL AND modeTransmissionId NOT IN (SELECT id FROM ModeTransmission)
`).all();

// 4. Future dates
anomalies.futureDateEnvoi = db.prepare(`
  SELECT id, numero, dateEnvoi
  FROM Courrier
  WHERE deletedAt IS NULL AND dateEnvoi > datetime('now', '+1 day')
`).all();

// 5. Incoherent dates (retrait before envoi)
anomalies.incoherentDates = db.prepare(`
  SELECT c.id, c.numero, c.dateEnvoi, r.dateRetrait
  FROM Courrier c
  JOIN Retrait r ON c.id = r.courrierId
  WHERE c.deletedAt IS NULL AND r.dateRetrait < c.dateEnvoi
`).all();

// 6. Empty required fields
anomalies.emptyFields = db.prepare(`
  SELECT id, numero, destinataire, objet
  FROM Courrier
  WHERE deletedAt IS NULL AND (TRIM(destinataire) = '' OR TRIM(objet) = '')
`).all();

// 7. Test/junk data
anomalies.junkData = db.prepare(`
  SELECT id, numero, signataire, destinataire, objet 
  FROM Courrier 
  WHERE deletedAt IS NULL 
  AND (
    LOWER(signataire) IN ('a', 'b', 'c', '1', '2', 'test', 'x') OR
    LOWER(destinataire) IN ('a', 'b', 'c', '1', '2', 'test', 'x') OR
    LOWER(objet) IN ('a', 'b', 'c', '1', '2', 'test', 'x')
  )
`).all();

console.log(JSON.stringify(anomalies, null, 2));
