// Générateurs de rapport d'audit HTML (scenario + index global)

import fs from 'node:fs'
import path from 'node:path'
import type { CategoryScore, Finding, ScenarioReport } from './types.js'

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const sevLabel: Record<string, string> = {
  critique: 'Critique',
  majeur: 'Majeur',
  mineur: 'Mineur',
  info: 'Info',
}
const sevColor: Record<string, string> = {
  critique: '#B91C1C',
  majeur: '#B45309',
  mineur: '#0369A1',
  info: '#64748B',
}

function badge(ok: boolean | 'n/a') {
  if (ok === 'n/a') return `<span style="background:#F1F5F9;color:#64748B;border-radius:6px;padding:1px 8px;font-size:11px">N/A</span>`
  if (ok === true) return `<span style="background:#ECFDF5;color:#059669;border-radius:6px;padding:1px 8px;font-size:11px">✓ PASS</span>`
  return `<span style="background:#FEF2F2;color:#B91C1C;border-radius:6px;padding:1px 8px;font-size:11px">✗ ÉCHEC</span>`
}

function scoreBar(score: number) {
  const color = score >= 95 ? '#059669' : score >= 85 ? '#0369A1' : score >= 70 ? '#B45309' : '#B91C1C'
  return `<div style="height:10px;background:#E2E8F0;border-radius:6px;overflow:hidden"><div style="width:${score}%;height:100%;background:${color}"></div></div>`
}

export function writeScenarioHtml(dir: string, rep: ScenarioReport, shots: string[]) {
  const bad = rep.checks.filter((c) => c.ok === false)
  const findingsHtml = bad.length
    ? `<h2 style="font-size:15px;margin:24px 0 10px">Défauts détectés (${bad.length})</h2>
       <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5">
        <tr style="background:#F1F5F9;color:#0F172A">
          <th style="text-align:left;padding:6px 8px">Page</th><th style="text-align:left;padding:6px 8px">Problème</th>
          <th style="text-align:left;padding:6px 8px">Pourquoi / Cause</th><th style="text-align:left;padding:6px 8px">Impact</th>
          <th style="text-align:left;padding:6px 8px">Correction proposée</th><th style="padding:6px 8px">Prio</th>
        </tr>
        ${bad
          .map(
            (f) => `<tr style="border-bottom:1px solid #E2E8F0">
            <td style="padding:6px 8px"><b style="color:${sevColor[f.severity]}">${f.page || '—'}</b></td>
            <td style="padding:6px 8px;max-width:220px">${esc(f.label)}<br/><span style="color:#64748B;font-size:11px">${esc(f.detail)}</span></td>
            <td style="padding:6px 8px;max-width:220px;color:#475569">${esc(f.cause)}</td>
            <td style="padding:6px 8px;max-width:200px;color:#475569">${esc(f.impact)}</td>
            <td style="padding:6px 8px;max-width:240px">${esc(f.fix)}</td>
            <td style="padding:6px 8px;text-align:center"><b style="color:${f.priority === 'P0' ? '#B91C1C' : '#B45309'}">${f.priority}</b></td>
          </tr>`,
          )
          .join('')}
       </table>`
    : `<p style="color:#059669;font-weight:600">Aucun défaut — rapport conforme à la charte.</p>`

  const catHtml = rep.categories
    .map(
      (c) => `<tr style="border-bottom:1px solid #E2E8F0">
        <td style="padding:6px 8px">${esc(c.label)}</td>
        <td style="padding:6px 8px;width:40%">${scoreBar(c.score)}</td>
        <td style="padding:6px 8px;text-align:right"><b>${c.score} / 100</b> <span style="color:#64748B">(${c.ok}/${c.total})</span></td>
      </tr>`,
    )
    .join('')

  const checklist = rep.checks
    .map(
      (c) => `<tr style="border-bottom:1px solid #F1F5F9">
        <td style="padding:4px 8px">${sevLabel[c.severity]}</td>
        <td style="padding:4px 8px">${esc(c.label)}</td>
        <td style="padding:4px 8px;text-align:center">${sevOk(c.ok)}</td>
        <td style="padding:4px 8px;color:#64748B;font-size:11px">${esc(c.detail)}</td>
      </tr>`,
    )
    .join('')

  const shotsHtml = shots
    .map(
      (s, idx) => `<figure style="display:inline-block;margin:6px;border:1px solid #E2E8F0;border-radius:8px;padding:8px;vertical-align:top">
        <figcaption style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600">Page ${String(idx + 1).padStart(2, '0')} · ${rep.pages[idx]?.layout ?? ''}</figcaption>
        <img src="${esc(s)}" width="230" style="border-radius:4px" loading="lazy"/>
      </figure>`
    )
    .join('')

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><title>Audit — ${esc(rep.label)}</title></head>
<body style="font-family:Arial,sans-serif;margin:0;background:#F8FAFC;color:#0F172A">
<div style="background:#0F172A;color:#fff;padding:18px 28px">
  <div style="font-size:12px;letter-spacing:2px;color:#5EEAD4">RAPPORT D'AUDIT VISUEL — DEX</div>
  <h1 style="margin:4px 0;font-size:20px">${esc(rep.label)}</h1>
  <div style="font-size:12px;color:#CBD5E1">${esc(rep.type)} · ${esc(rep.reportType)} · ${rep.numPages} pages · ${(rep.fileSize / 1024).toFixed(0)} Ko · ${esc(rep.generatedAt)}</div>
</div>
<div style="padding:24px 28px">
  <div style="display:flex;gap:16px;flex-wrap:wrap">
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px 24px;flex:1;min-width:260px">
      <div style="font-size:12px;color:#64748B;text-transform:uppercase">Score global</div>
      <div style="font-size:44px;font-weight:700;color:${rep.globalScore >= 95 ? '#059669' : rep.globalScore >= 85 ? '#0369A1' : '#B45309'}">${rep.globalScore}<span style="font-size:20px;color:#94A3B8">/100</span></div>
      <div style="margin-top:6px">${scoreBar(rep.globalScore)}</div>
      <div style="margin-top:8px;font-weight:700;color:${rep.verdict === 'CONFORME' ? '#059669' : '#B45309'}">Verdict : ${esc(rep.verdict)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px">Objectif minimum : 95/100</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px 24px;flex:1;min-width:260px">
      <div style="font-size:12px;color:#64748B;text-transform:uppercase">Répartition</div>
      <table style="width:100%">${Object.entries(rep.findingsBySeverity)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 0;color:${sevColor[k]}"><b>${sevLabel[k]}</b></td><td style="text-align:right"><b>${v.filter((f) => f.ok === false).length}</b></td></tr>`,
        )
        .join('')}</table>
    </div>
  </div>

  ${findingsHtml}

  <h2 style="font-size:15px;margin:24px 0 10px">Scores par critère</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">${catHtml}</table>

  <h2 style="font-size:15px;margin:24px 0 10px">Checklist — Marche / Échec</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #E2E8F0;border-radius:8px">${checklist}</table>

  <h2 style="font-size:15px;margin:24px 0 10px">Captures par page</h2>
  <div>${shotsHtml}</div>
</div>
</body></html>`

  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

function sevOk(ok: boolean | 'n/a') {
  return okPad(ok)
}
function okPad(ok: boolean | 'n/a') {
  return ok === 'n/a' ? 'N/A' : ok ? '✓' : '✗'
}

export function writeIndexHtml(outDir: string, all: ScenarioReport[]) {
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b.globalScore, 0) / all.length) : 0
  const rows = all
    .map(
      (r) => `<tr style="border-bottom:1px solid #E2E8F0">
        <td style="padding:8px"><a href="${esc(r.scenarioId)}/index.html" style="color:#0F766E;text-decoration:none;font-weight:600">${esc(r.label)}</a></td>
        <td style="padding:8px;color:#64748B">${esc(r.type)} / ${esc(r.reportType)}</td>
        <td style="padding:8px;text-align:center">${r.numPages}</td>
        <td style="padding:8px;text-align:center">${scoreBar(r.globalScore)}</td>
        <td style="padding:8px;text-align:center;font-weight:700;color:${r.globalScore >= 95 ? '#059669' : '#B45309'}">${r.globalScore}</td>
        <td style="padding:8px;text-align:center">${r.verdict === 'CONFORME' ? '<span style="color:#059669;font-weight:600">CONFORME</span>' : '<span style="color:#B91C1C;font-weight:600">À CORRIGER</span>'}</td>
      </tr>`,
    )
    .join('')
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><title>Audit visuel des rapports — DEX</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#F8FAFC;color:#0F172A">
<div style="background:#0F172A;color:#fff;padding:20px 28px">
  <div style="font-size:12px;letter-spacing:2px;color:#5EEAD4">AUDIT QUALITÉ — RAPPORTS EXÉCUTIFS / STANDARDS</div>
  <h1 style="font-size:22px;margin:4px 0">Suite de tests visuels Playwright</h1>
  <div style="font-size:12px;color:#CBD5E1">Génération → Capture → Analyse pixel/texte → Score ≥ 95/100 · ${all.length} scénarios · moyenne ${avg}/100</div>
</div>
<div style="padding:24px 28px">
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px">
    ${all.length === 0 ? '<p>Aucun rapport audité.</p>' : ` <table style="width:100%;border-collapse:collapse">
      <tr style="color:#64748B;font-size:11px;text-transform:uppercase;border-bottom:2px solid #E2E8F0">
        <th style="text-align:left;padding:8px">Rapport</th><th style="text-align:left;padding:8px">Format</th>
        <th style="padding:8px">Pages</th><th style="padding:8px">Score</th><th style="padding:8px">Note</th><th style="padding:8px">Verdict</th>
      </tr>
      ${rows}
    </table>`}
  </div>
</div>
</body></html>`
  fs.writeFileSync(path.join(outDir, 'index.html'), html)
}