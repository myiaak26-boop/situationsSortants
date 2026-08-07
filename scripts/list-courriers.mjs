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
  const { json: { token } } = await request('POST', '/api/auth/login', null, { email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local', password: process.env.DEX_ADMIN_PASSWORD || 'admin123' })
  const { json: j } = await request('GET', '/api/courriers?page=1&pageSize=100', token)
  const arr = Array.isArray(j) ? j : j.data || j.items || []
  console.log('total:', arr.length)
  console.log(JSON.stringify(arr, null, 1).slice(0, 1600))
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })