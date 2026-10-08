import { useState } from 'react'
import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { SIGNERS, type ReportStatus, type ReportSummary } from '@/lib/sop'
import { cn } from '@/lib/utils'

const STATUS: Record<ReportStatus, { text: string; tone: 'primary' | 'error' | 'neutral'; icon: typeof CircleCheck }> = {
  selesai: { text: 'Selesai', tone: 'primary', icon: CircleCheck },
  anomali: { text: 'Anomali', tone: 'error', icon: TriangleAlert },
  draft: { text: 'Draft', tone: 'neutral', icon: CircleDashed },
}

type Filter = 'semua' | ReportStatus

const ttdText = (r: ReportSummary) => {
  // Ringkasan lama belum mencatat tanda tangan.
  if (!r.ttdKurang) return '-'
  if (!r.ttdKurang.length) return 'Lengkap'
  return `Menunggu ${r.ttdKurang.map((k) => SIGNERS.find((s) => s.key === k)?.label ?? k).join(', ')}`
}

const COLS: Col<ReportSummary>[] = [
  { header: 'BBM', cell: (r) => <ProdukChip produk={r.produk} />, mobileCell: (r) => r.produk || '-', mobile: 'title' },
  { header: 'Nopol', cell: (r) => <span className="tabular whitespace-nowrap">{r.nopol || 'MT'}</span>, mobile: 'title' },
  { header: 'Tanggal / Jam', cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggalIso(r.tanggal)} {r.jam}</span>, mobile: 'sub' },
  { header: 'No BA', cell: (r) => <span className="tabular text-on-surface-variant">{r.noBA || '-'}</span>, mobile: 'hide' },
  { header: 'Volume (L)', cell: (r) => (r.volumeDO ? formatNumber(r.volumeDO) : '-'), align: 'right', mobile: 'hide' },
  {
    header: 'Tanda tangan',
    cell: (r) => <span className={cn(r.ttdKurang?.length ? 'font-semibold text-error' : 'text-on-surface-variant')}>{ttdText(r)}</span>,
    mobile: 'sub',
  },
  {
    header: 'Status',
    cell: (r) => {
      const s = STATUS[r.status]
      const Icon = s.icon
      return (
        <Pill tone={s.tone}>
          <Icon aria-hidden="true" />
          {s.text}
        </Pill>
      )
    },
    mobile: 'badge',
  },
]

/** Laporan > Berita Acara: buka untuk tanda tangan pengawas/ABH atau unduh Excel, PDF, JPG. */
export function BeritaAcara() {
  const app = useApp()
  const [filter, setFilter] = useState<Filter>('semua')
  const [range, setRange] = useDateRange('month')

  if (!app.loaded) return <Loading />

  const inDate = app.reports.filter((r) => inRange(r.tanggal, range))
  const rows = filter === 'semua' ? inDate : inDate.filter((r) => r.status === filter)
  const count = (s: Filter) => (s === 'semua' ? inDate.length : inDate.filter((r) => r.status === s).length)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="ba-range" value={range} onChange={setRange} />
        <div role="group" aria-label="Saring status" className="grid grid-cols-4 gap-space-xs">
          {(['semua', 'selesai', 'anomali', 'draft'] as const).map((s) => {
            const on = filter === s
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={cn(
                  'flex min-h-14 min-w-0 flex-col items-start justify-center rounded-md px-space-xs text-left transition-colors duration-200 active:scale-[0.98]',
                  on ? 'bg-primary text-on-primary' : 'bg-surface-container-low/70 text-on-surface',
                )}
              >
                <span className={cn('max-w-full truncate text-tag uppercase', on ? 'text-on-primary' : 'text-on-surface-variant')}>{s === 'semua' ? 'Semua' : STATUS[s].text}</span>
                <span className="tabular text-numeric-md font-bold">{count(s)}</span>
              </button>
            )
          })}
        </div>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Berita Acara" rows={rows} total={app.reports.length} cols={COLS} rowKey={(r) => r.id} to={(r) => `/input/${r.id}`} empty="Tidak ada Berita Acara pada rentang tanggal dan status ini." />
      </div>
    </div>
  )
}
