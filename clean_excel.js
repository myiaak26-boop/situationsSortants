const XLSX = require('./node_modules/xlsx');
const fs = require('fs');

const inputFile = './test/Liste des courriers sortants normaux (1).xlsx';
const outputFile = './test/Liste des courriers sortants normaux_cleaned.xlsx';

console.log(`Lecture du fichier: ${inputFile}...`);
const wb = XLSX.readFile(inputFile);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log(`Lignes totales avant nettoyage: ${rows.length}`);

// Set to track seen IDs
const seenIds = new Set();
// Cleaned data
const cleanedRows = [];

let duplicatesRemoved = 0;
let expediteurFixed = 0;

rows.forEach((row, index) => {
  const line = index + 2;
  let numero = String(row['Numéro'] || '').trim();
  
  // Rule 0: Remove junk suffixes (e.g. 1219-26_del_MxSra -> 1219)
  numero = numero.replace(/_del_.*$/, '');
  numero = numero.replace(/-\d{2}$/, '');
  row['Numéro'] = numero;
  
  // Rule 1: Remove duplicates
  if (numero && seenIds.has(numero)) {
    duplicatesRemoved++;
    return; // Skip duplicate
  }
  
  if (numero) {
    seenIds.add(numero);
  }

  // Rule 2: Note missing 'Expéditeur'
  const expediteur = String(row['Expéditeur'] || '').trim();
  if (!expediteur) {
    expediteurFixed++;
    // We can fix it by adding a default if needed, or just leave it empty. 
    // Here we leave it but count it. 
    // row['Expéditeur'] = 'INCONNU'; 
  }

  cleanedRows.push(row);
});

console.log(`Lignes supprimées (doublons): ${duplicatesRemoved}`);
console.log(`Lignes avec "Expéditeur" manquant: ${expediteurFixed} (non modifiées, à vous de remplir)`);
console.log(`Lignes totales après nettoyage: ${cleanedRows.length}`);

console.log(`Génération du nouveau fichier...`);
const newSheet = XLSX.utils.json_to_sheet(cleanedRows);
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);

XLSX.writeFile(newWb, outputFile);
console.log(`Fichier nettoyé enregistré sous: ${outputFile}`);
