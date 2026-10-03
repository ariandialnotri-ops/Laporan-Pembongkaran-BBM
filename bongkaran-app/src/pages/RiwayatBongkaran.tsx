import { useState } from 'react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber, formatSigned } from '@/lib/format'
import { PRODUK_OPTIONS, STEPS, type ReportSummary } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Keterangan hasil bongkar, seperti kolom keterangan pada rekap transaksi. */
function keterangan(r: ReportSummary): { text: string; tone: 'neutral' | 'error' } {
  if (r.densityAnomaly) return { text: 'Anomali density', tone: 'error' }
  if (r.sample2Jam?.ok === false) return { text: 'Sample 2 jam beda', tone: 'error' }
  if (r.gainLoss !== null && r.gainLoss < 0) return { text: `Loss ${formatSigned(r.gainLoss, 0, ' L')}`, tone: 'error' }
  return { text: 'Normal', tone: 'neutral' }
}

/** Tindakan berikutnya untuk bongkaran ini. */
function progress(r: ReportSummary) {
  if (r.status === 'draft') return `Tahap ${Math.min(r.doneCount + 1, STEPS.length)} dari ${STEPS.length}`
  if (r.status === 'anomali') return 'Tindak lanjut anomali'
  if (!r.sample2Jam) return 'Menunggu sample 2 jam'
  if (r.ttdKurang?.length) return 'Menunggu tanda tangan'
  return 'Selesai'
}

const STATUS = { selesai: 'Selesai', anomali: 'Anomali', draft: 'Berjalan' } as const

const COLS: Col<ReportSummary>[] = [
  { header: 'BBM', cell: (r) => <ProdukChip produk={r.produk} />, mobileCell: (r) => r.produk || '-', mobile: 'title' },
  { header: 'Nopol', cell: (r) => (r.nopol ? <span className="tabular whitespace-nowrap">{r.nopol}</span> : <span className="tabular italic text-on-surface-variant">tanpa nopol</span>), mobile: 'title' },
  {
    header: 'Tanggal / Jam',
    cell: (r) => (
      <span className="tabular whitespace-nowrap">
        {formatTanggalIso(r.tanggal)} <span className="text-on-surface-variant">{r.jam}</span>
      </span>
    ),
    mobile: 'sub',
  },
  { header: 'Volume (L)', cell: (r) => <span className="font-semibold">{r.volumeDO ? formatNumber(r.volumeDO) : '-'}</span>, align: 'right', mobile: 'hide' },
  {
    header: 'Keterangan',
    cell: (r) => {
      const k = keterangan(r)
      return (
        <Pill tone={k.tone} className="normal-case tracking-normal">
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', k.tone === 'error' ? 'bg-error' : 'bg-on-surface-variant')} />
          {k.text}
        </Pill>
      )
    },
    mobile: 'badge',
  },
  { header: 'Status', cell: (r) => <span className="text-on-surface-variant">{STATUS[r.status]}</span>, mobile: 'hide' },
  {
    header: 'Progress tindakan',
    cell: (r) => <span className={cn(progress(r) === 'Selesai' ? 'text-on-surface-variant' : 'font-semibold text-primary')}>{progress(r)}</span>,
    mobile: 'sub',
  },
]

/** Laporan > Riwayat Pembongkaran MT. */
export function RiwayatBongkaran() {
  const app = useApp()
  const [range, setRange] = useDateRange('month')
  const [produk, setProduk] = useState('semua')
  if (!app.loaded) return <Loading />

  const rows = app.reports.filter((r) => inRange(r.tanggal, range) && (produk === 'semua' || r.produk === produk))
  const liter = rows.filter((r) => r.status === 'selesai').reduce((n, r) => n + (r.volumeDO ?? 0), 0)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="mt-range" value={range} onChange={setRange} />
        <ChipFilter label="Produk" value={produk} onChange={setProduk} options={[{ value: 'semua', label: 'Semua produk' }, ...PRODUK_OPTIONS.map((p) => ({ value: p, label: p }))]} />
        <span className="tabular text-body-sm text-on-surface-variant">
          {rows.length} bongkaran, {formatNumber(liter)} L diterima
        </span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Pembongkaran MT" rows={rows} total={app.reports.length} cols={COLS} rowKey={(r) => r.id} to={(r) => `/input/${r.id}`} empty="Tidak ada bongkaran pada rentang ini." />
      </div>
    </div>
  )
}
