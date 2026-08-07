import Database from 'better-sqlite3';
const db = new Database('./dev.db');
const rows = db.prepare("SELECT id, numero, signataire FROM Courrier WHERE signataire LIKE '%Test CRUD%' AND deletedAt IS NULL").all();
console.log('Rows found:', rows);
db.prepare("UPDATE Courrier SET deletedAt = datetime('now') WHERE signataire LIKE '%Test CRUD%' AND deletedAt IS NULL").run();
console.log('Deleted.');
