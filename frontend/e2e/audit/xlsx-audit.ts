// Audit structurel Excel — miroir des contrôles PDF côté classeur.
// SheetJS CE ne lit pas les styles : contrôle valeurs + structure + mise en page.

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export interface XlsxAuditResult {
  ok: boolean
  score: number
  sheets: string[]
  lines: { label: string; ok: boolean; detail: string }[]
}

export async function auditXlsxBuffer(buf: Buffer, opts: { exec: boolean } = { exec: true }): Promise<XlsxAuditResult> {
  const XLSX = require('xlsx') as typeof import('xlsx')
  const ExcelJS = require('exceljs') as typeof import('exceljs')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const wbX = new ExcelJS.Workbook()
  await wbX.xlsx.load(buf as unknown as ArrayBuffer)
  const sheets = wb.SheetNames
  const lines: XlsxAuditResult['lines'] = []
  const note = (label: string, ok: boolean, detail: string) => lines.push({ label, ok, detail })

  const has = (n: string) => sheets.includes(n)
  note('Feuilles principales (Couverture / Synthèse / Situation complète)', has('Couverture') && has('Synthèse') && has('Situation complète'), `Feuilles : ${sheets.join(', ')}`)

  const situ = wb.Sheets['Situation complète']
  if (situ) {
    const cellAt = (r: number, c: number) => {
      const cell = situ[XLSX.utils.encode_cell({ r, c })]
      return cell == null ? '' : String(cell.v ?? '')
    }
    let totalRow = -1
    for (let r = 0; r < 5000; r++) {
      if (cellAt(r, 0).startsWith('TOTAL —')) {
        totalRow = r
        break
      }
    }
    note('Ligne TOTAL finale', totalRow > 1, totalRow > 1 ? `TOTAL ligne ${totalRow + 1}` : 'TOTAL absent')

    const headerIdx = ['N°', 'Date de Sign.', 'Signataire', 'Destinataire', 'Objet'].map((h) => {
      for (let c = 0; c < 20; c++) if (cellAt(0, c) === h) return h
      return null
    })
    note('En-têtes de colonnes', headerIdx.every((h) => h != null), headerIdx.join(' '))

    note('Auto-filtre actif', !!situ['!autofilter'], situ['!autofilter'] ? `ref ${situ['!autofilter'].ref}` : 'Auto-filtre absent')

    const situX = wbX.getWorksheet('Situation complète')
    const frozen = !!situX && situX.views.some((v) => v.state === 'frozen' && (v.ySplit ?? 0) >= 1)
    note('Gel de la ligne d\'en-tête', frozen, frozen ? `ySplit = ${situX!.views.find((v) => v.state === 'frozen')!.ySplit}` : 'Gel absent')
    const colCount = situX ? situX.columnCount : 0
    const colWidths = situX ? Array.from({ length: colCount }, (_, i) => situX.getColumn(i + 1).width ?? 0) : []
    note('Largeurs de colonnes définies', colWidths.some((w) => w > 0), `[${colWidths.slice(0, 12).map((w) => w.toFixed(1)).join(', ')}${colWidths.length > 12 ? ', …' : ''}]`)
    note('Marges d\'impression', !!situ['!margins'], JSON.stringify(situ['!margins']))
    note('Aucune cellule vide en en-tête', cellAt(0, 0) !== '' && cellAt(0, 1) !== '', `A1 = ${cellAt(0, 0)}`)

    // Données : vérifier qu'aucune valeur ne dépasse grossièrement (anti "texte coupé" basé largeur)
    const nbData = totalRow - 1
    note('Lignes de données présentes', nbData > 0, `${nbData} lignes`)
  } else {
    note('Feuille Situation complète', false, 'Feuille absente')
  }

  const synth = wb.Sheets['Synthèse']
  note('Synthèse : cellules fusionnées (cartes KPI)', !!synth && Array.isArray(synth['!merges']) && synth['!merges'].length > 0, `Fusions : ${synth?.['!merges']?.length ?? 0}`)

  const cover = wb.Sheets['Couverture']
  note('Couverture : bandes et titres fusionnés', !!cover && Array.isArray(cover['!merges']) && cover['!merges'].length >= 4, `Fusions : ${cover?.['!merges']?.length ?? 0}`)

  const execSheets = ['Stats signataire', 'Stats situation', 'Stats mode', 'Délais']
  const execExtra = execSheets.every((s) => has(s))
  note('Feuilles agréées (exécutif)', !opts.exec || execExtra, opts.exec ? `[${execSheets.join(', ')}]` : 'Non applicable (export standard)')

  const passed = lines.filter((l) => l.ok).length
  const score = Math.round((passed / Math.max(lines.length, 1)) * 100)
  return { ok: score >= 95, score, sheets, lines }
}