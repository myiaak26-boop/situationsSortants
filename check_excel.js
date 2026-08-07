const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('./test/Liste des courriers entrants (13).xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
console.log('Colonnes:', JSON.stringify(Object.keys(rows[0] || {})));
console.log('Total lignes:', rows.length);
rows.slice(0, 5).forEach((r, i) => {
  console.log('Ligne ' + (i+1) + ':', JSON.stringify(r));
  const d = r["Date d'envoi"];
  console.log('  Date type:', typeof d, 'value:', d);
  console.log('  Numero:', r['Numéro']);
});