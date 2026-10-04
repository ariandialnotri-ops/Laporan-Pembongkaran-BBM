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
import { formatDurasi, slaOf } from '@/lib/sla'
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

type Row = ReportSummary & { sla: { permintaan: number | null; perjalanan: number | null } }

const COLS: Col<Row>[] = [
  { header: 'Produk', cell: (r) => <ProdukChip produk={r.produk} />, mobileCell: (r) => r.produk || '-', mobile: 'title' },
  {
    header: 'Tgl penerimaan',
    cell: (r) => (
      <span className="tabular whitespace-nowrap">
        {formatTanggalIso(r.tanggal)} <span className="text-on-surface-variant">{r.jam}</span>
      </span>
    ),
    mobileCell: (r) => `${formatTanggalIso(r.tanggal)} ${r.jam}`,
    mobile: 'title',
  },
  { header: 'No SO', cell: (r) => <span className="tabular whitespace-nowrap">{r.noSO || '-'}</span>, mobile: 'hide' },
  { header: 'No LO', cell: (r) => <span className="tabular whitespace-nowrap">{r.noLOs.join(', ') || '-'}</span>, mobile: 'hide' },
  { header: 'SO / LO', cell: (r) => `SO ${r.noSO || '-'}, LO ${r.noLOs.join(', ') || '-'}`, mobile: 'sub', desktop: false },
  {
    header: 'Nopol & supir',
    cell: (r) => (
      <span className="flex flex-col">
        {r.nopol ? <span className="tabular whitespace-nowrap">{r.nopol}</span> : <span className="tabular italic text-on-surface-variant">tanpa nopol</span>}
        <span className="text-body-sm text-on-surface-variant">{r.namaDriver || '-'}</span>
      </span>
    ),
    mobileCell: (r) => `${r.nopol || 'MT'}, ${r.namaDriver || '-'}`,
    mobile: 'sub',
  },
  { header: 'Volume (L)', cell: (r) => <span className="font-semibold">{r.volumeDO ? formatNumber(r.volumeDO) : '-'}</span>, align: 'right', mobile: 'hide' },
  {
    header: 'Transport loss (L)',
    cell: (r) => <span className={cn((r.transportLoss ?? 0) < 0 && 'text-error')}>{r.transportLoss !== null && r.transportLoss !== undefined ? formatSigned(r.transportLoss, 0) : '-'}</span>,
    align: 'right',
    mobile: 'hide',
  },
  {
    header: 'Discharge loss',
    cell: (r) => (
      <span className={cn('flex flex-col items-end', (r.gainLoss ?? 0) < 0 && 'text-error')}>
        <span>{r.gainLoss !== null ? `${formatSigned(r.gainLoss, 0)} L` : '-'}</span>
        {r.gainLossPct !== null && r.gainLossPct !== undefined && <span className="text-body-sm">{formatSigned(r.gainLossPct, 2, '%')}</span>}
      </span>
    ),
    align: 'right',
    mobile: 'hide',
  },
  {
    header: 'Losses',
    cell: (r) =>
      `Volume ${r.volumeDO ? formatNumber(r.volumeDO) : '-'} L, transport ${r.transportLoss != null ? formatSigned(r.transportLoss, 0) : '-'} L, discharge ${r.gainLoss !== null ? formatSigned(r.gainLoss, 0) : '-'} L${r.gainLossPct != null ? ` (${formatSigned(r.gainLossPct, 2, '%')})` : ''}`,
    mobile: 'sub',
    desktop: false,
  },
  {
    header: 'SLA',
    cell: (r) => (
      <span className="flex flex-col whitespace-nowrap text-body-sm">
        <span title="Request MS2 sampai selesai bongkar">Req: {formatDurasi(r.sla.permintaan)}</span>
        <span className="text-on-surface-variant" title="Gate out depot sampai selesai bongkar">
          Gate out: {formatDurasi(r.sla.perjalanan)}
        </span>
      </span>
    ),
    mobileCell: (r) => `SLA request ${formatDurasi(r.sla.permintaan)}, gate out ${formatDurasi(r.sla.perjalanan)}`,
    mobile: 'sub',
  },
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
    cell: (r) => <span className={cn('whitespace-nowrap', progress(r) === 'Selesai' ? 'text-on-surface-variant' : 'font-semibold text-primary')}>{progress(r)}</span>,
    mobile: 'hide',
  },
]

/** Laporan > Riwayat Pembongkaran MT. */
export function RiwayatBongkaran() {
  const app = useApp()
  const [range, setRange] = useDateRange('month')
  const [produk, setProduk] = useState('semua')
  if (!app.loaded) return <Loading />

  const rows: Row[] = app.reports.filter((r) => inRange(r.tanggal, range) && (produk === 'semua' || r.produk === produk)).map((r) => ({ ...r, sla: slaOf(r, app.plans) }))
  const liter = rows.filter((r) => r.status === 'selesai').reduce((n, r) => n + (r.volumeDO ?? 0), 0)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="mt-range" value={range} onChange={setRange} />
        <ChipFilter label="Produk" value={produk} onChange={setProduk} options={[{ value: 'semua', label: 'Semua produk' }, ...PRODUK_OPTIONS.map((p) => ({ value: p, label: p }))]} />
        <span className="tabular text-body-sm text-on-surface-variant">
          {rows.length} bongkaran, {formatNumber(liter)} L diterima. SLA: request MS2 dan gate out depot sampai selesai bongkar.
        </span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Pembongkaran MT" rows={rows} total={app.reports.length} cols={COLS} rowKey={(r) => r.id} to={(r) => `/input/${r.id}`} empty="Tidak ada bongkaran pada rentang ini." />
      </div>
    </div>
  )
}
