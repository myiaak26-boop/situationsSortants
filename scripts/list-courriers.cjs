const base = 'http://localhost:3000'
const request = (method, path, token, body) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = require('http').request(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(b) }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })

async function main() {
  const { json: { token } } = await request('POST', '/api/auth/login', null, {
    email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local',
    password: process.env.DEX_ADMIN_PASSWORD || 'admin123',
  })
  const { json: j } = await request('GET', '/api/courriers?page=1&pageSize=100', token)
  const arr = Array.isArray(j) ? j : j.data || j.items || []

  const params = await request('GET', '/api/parametres', token)
  console.log('PARAMETRES // situations =', JSON.stringify(params.json.situations || params.json, null, 0).slice(0, 800))

  console.log('\nCOURRIERS')
  for (const c of arr) {
    console.log(
      `${c.numero.padEnd(10)} | ${String(c.dateEnvoi || '').slice(0, 10)} | ${(c.signataire || '?').padEnd(22)} | ` +
        `situ=${String(c.situation?.nom).padEnd(22)} | mode=${String(c.modeTransmission?.nom).slice(0, 20).padEnd(20)} | ` +
        `msgEnt=${String(c.numeroEntrant).padEnd(6)} | arr=${String(c.dateArriveeEntrant?.slice(0, 10) || '').padEnd(10)} | objet=${String(c.objet).slice(0, 34)}`,
    )
  }
  console.log('\nNB: objet ', arr.map((c) => c.objet).join(' | '))
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })