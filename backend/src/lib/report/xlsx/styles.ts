import XLSX from 'xlsx'
import { COLORS, tint } from '../theme.js'

export interface CellBorder {
  style?: string
  color?: { rgb: string }
}

export interface CellStyle {
  font?: { bold?: boolean; italic?: boolean; sz?: number; color?: { rgb: string } }
  fill?: { fgColor?: { rgb: string } }
  border?: { top?: CellBorder; bottom?: CellBorder; left?: CellBorder; right?: CellBorder }
  alignment?: { wrapText?: boolean; vertical?: string; horizontal?: string }
}

export const STYLE = {
  h1: { font: { bold: true, sz: 16, color: { rgb: COLORS.ink } } } as CellStyle,
  h1Teal: { font: { bold: true, sz: 13, color: { rgb: COLORS.teal } } } as CellStyle,
  h2: { font: { bold: true, sz: 11, color: { rgb: COLORS.white } }, fill: { fgColor: { rgb: COLORS.teal } }, alignment: { vertical: 'center' } } as CellStyle,
  h3: { font: { bold: true, sz: 11, color: { rgb: COLORS.ink } } } as CellStyle,
  sub: { font: { color: { rgb: COLORS.muted }, sz: 10 } } as CellStyle,
  bold: { font: { bold: true } } as CellStyle,
  th: {
    font: { bold: true, color: { rgb: COLORS.white }, sz: 10 },
    fill: { fgColor: { rgb: COLORS.ink } },
    border: { bottom: { style: 'thin', color: { rgb: COLORS.hair } } },
  } as CellStyle,
  zebra: { fill: { fgColor: { rgb: COLORS.panel } } } as CellStyle,
  total: {
    font: { bold: true, color: { rgb: COLORS.white }, sz: 10 },
    fill: { fgColor: { rgb: COLORS.teal } },
  } as CellStyle,
  kpiBox: {
    fill: { fgColor: { rgb: COLORS.panel } },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.hair } },
      bottom: { style: 'thin', color: { rgb: COLORS.hair } },
      left: { style: 'thin', color: { rgb: COLORS.hair } },
      right: { style: 'thin', color: { rgb: COLORS.hair } },
    },
    alignment: { vertical: 'center' },
  } as CellStyle,
  bandeTop: { fill: { fgColor: { rgb: COLORS.teal } } } as CellStyle,
  bandeBot: { fill: { fgColor: { rgb: COLORS.ink } } } as CellStyle,
  meta: { font: { color: { rgb: COLORS.muted }, sz: 8 } } as CellStyle,
  italic: { font: { italic: true, sz: 11, color: { rgb: COLORS.muted } } } as CellStyle,
}

export function badgeStyle(color: string): CellStyle {
  return {
    font: { bold: true, color: { rgb: color.replace('#', '') }, sz: 9 },
    fill: { fgColor: { rgb: tint(color, 0.13).replace('#', '') } },
    alignment: { vertical: 'center', horizontal: 'center' },
  }
}

export function kpiValueStyle(color: string): CellStyle {
  return { font: { bold: true, sz: 16, color: { rgb: color.replace('#', '') } } }
}

export function kpiLabelStyle(): CellStyle {
  return { font: { color: { rgb: COLORS.muted }, sz: 8 } }
}
