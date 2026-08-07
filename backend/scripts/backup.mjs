import DatabaseCtor from 'better-sqlite3'
const Database = DatabaseCtor
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'

const DB_PATH = resolve(process.env.DATABASE_URL?.replace('file:', '') || 'dev.db')
const BACKUP_DIR = resolve(process.env.BACKUP_DIR || 'backups')
const KEEP = parseInt(process.env.BACKUP_KEEP || '10', 10)

mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dest = join(BACKUP_DIR, `dex-${stamp}.db`)

const db = new Database(DB_PATH)
await db.backup(dest)
db.close()

const files = readdirSync(BACKUP_DIR)
  .filter((f) => f.startsWith('dex-') && f.endsWith('.db'))
  .map((f) => join(BACKUP_DIR, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
for (const old of files.slice(KEEP)) unlinkSync(old)

const size = statSync(dest).size
console.log(`Backup OK : ${dest} (${(size / 1024).toFixed(0)} Ko)`)
