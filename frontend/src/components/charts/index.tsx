import { cn } from '@/lib/cn'

export interface ChartDatum {
  label: string
  value: number
}

const THEME_PALETTE = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']
const EXTENDED_PALETTE = [...THEME_PALETTE, '#0891B2', '#65A30D', '#DB2777', '#475569']

export function BarsChart({
  data,
  color = 'var(--primary)',
  maxBars = 8,
  onRowClick,
}: {
  data: ChartDatum[]
  color?: string
  maxBars?: number
  onRowClick?: (label: string) => void
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxBars)
  const max = Math.max(1, ...sorted.map((d) => d.value))
  if (sorted.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">Aucune donnée</p>
  return (
    <div className="space-y-2.5">
      {sorted.map((d) => (
        <div
          key={d.label}
          onClick={onRowClick ? () => onRowClick(d.label) : undefined}
          className={cn('flex items-center gap-3', onRowClick && 'cursor-pointer rounded-lg px-1 transition-colors hover:bg-muted/40')}
        >
          <span className="w-32 shrink-0 truncate text-right text-2xs text-muted-foreground" title={d.label}>
            {d.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color, opacity: 0.85 }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-2xs font-semibold tabular-nums text-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({
  data,
  maxSegments = 7,
  colorFor,
  onSegmentClick,
}: {
  data: ChartDatum[]
  maxSegments?: number
  colorFor?: (label: string) => string | undefined
  onSegmentClick?: (label: string) => void
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, maxSegments)
  const autresValue = sorted.slice(maxSegments).reduce((s, d) => s + d.value, 0)
  const segments: ChartDatum[] = autresValue > 0 ? [...top, { label: 'Autres', value: autresValue }] : top
  const total = segments.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="py-8 text-center text-xs text-muted-foreground">Aucune donnée</p>

  const colorAt = (label: string, i: number) => colorFor?.(label) || EXTENDED_PALETTE[i % EXTENDED_PALETTE.length]

  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0
  const arcs = segments.map((d, i) => {
    const frac = d.value / total
    const arc = {
      dash: Math.max(0.5, frac * C - 2),
      offset: -acc * C,
      color: colorAt(d.label, i),
      ...d,
    }
    acc += frac
    return arc
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0">
        <svg viewBox="0 0 160 160" className="h-40 w-40">
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--muted)" strokeOpacity="0.4" strokeWidth="18" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="18"
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={a.offset}
              transform="rotate(-90 80 80)"
              strokeLinecap="butt"
              className={cn(onSegmentClick && 'cursor-pointer transition-opacity hover:opacity-80')}
              onClick={onSegmentClick ? () => onSegmentClick(a.label) : undefined}
            />
          ))}
          <text x="80" y="78" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>
            {total}
          </text>
          <text x="80" y="96" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            courriers
          </text>
        </svg>
      </div>
      <div className="w-full min-w-0 space-y-1.5">
        {arcs.map((a) => (
          <div
            key={a.label}
            onClick={onSegmentClick ? () => onSegmentClick(a.label) : undefined}
            className={cn('flex min-w-0 items-center gap-2 text-xs', onSegmentClick && 'cursor-pointer rounded-lg px-1 transition-colors hover:bg-muted/40')}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: a.color }} />
            <span className="flex-1 truncate text-muted-foreground" title={a.label}>
              {a.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{a.value}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground/70">{Math.round((a.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineChart({ points }: { points: { libelle: string; total: number }[] }) {
  if (points.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">Aucune donnée</p>

  const W = 620
  const H = 190
  const PAD = 10
  const max = Math.max(1, ...points.map((p) => p.total))
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1))
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const labelStep = Math.max(1, Math.ceil(points.length / 7))

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full" role="img">
        <defs>
          <linearGradient id="dex-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - (H - 2 * PAD) * f}
            y2={H - PAD - (H - 2 * PAD) * f}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        <path d={areaPath} fill="url(#dex-line-fill)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.libelle}>
            <circle cx={x(i)} cy={y(p.total)} r="3" fill="var(--primary)" stroke="var(--card)" strokeWidth="1.5" />
            {i % labelStep === 0 && (
              <text x={x(i)} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                {p.libelle}
              </text>
            )}
            {i % labelStep === 0 && (
              <text x={x(i)} y={y(p.total) - 8} textAnchor="middle" className={cn('fill-foreground')} style={{ fontSize: 10, fontWeight: 600 }}>
                {p.total}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
