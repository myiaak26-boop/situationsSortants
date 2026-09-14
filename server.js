require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.static(__dirname));
app.use(express.json({ limit: '25mb' }));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      raw_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      incoming_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO app_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING
  `);
}

app.get('/api/state', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT raw_data, incoming_data, updated_at FROM app_state WHERE id = 1'
    );
    const row = rows[0];
    res.json({
      ok: true,
      rawData: row ? row.raw_data : [],
      incomingData: row ? row.incoming_data : [],
      updatedAt: row ? row.updated_at : null
    });
  } catch (err) {
    console.error('GET /api/state', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    const { rawData, incomingData } = req.body || {};
    const updatedAt = new Date();
    await pool.query(
      `UPDATE app_state
       SET raw_data = $1::jsonb, incoming_data = $2::jsonb, updated_at = $3
       WHERE id = 1`,
      [
        JSON.stringify(rawData || []),
        JSON.stringify(incomingData || []),
        updatedAt
      ]
    );
    res.json({ ok: true, updatedAt });
  } catch (err) {
    console.error('POST /api/state', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function start() {
  initSchema()
    .then(() => {
      console.log('Base de données prête.');
      app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
    })
    .catch(async (err) => {
      console.error('Initialisation de la base échouée :', err.message);
      for (let i = 1; i <= Number(process.env.DB_MAX_RETRIES || 10); i++) {
        console.log(`Nouvelle tentative dans 5 s (essai ${i}/10)...`);
        await sleep(5000);
        try {
          await initSchema();
          console.log('Base de données prête.');
          app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
          return;
        } catch (e) {
          console.error('Tentative échouée :', e.message);
        }
      }
      console.error('Base inaccessible, démarrage du serveur sans base.');
      app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT} (sans base)`));
    });
}

start();