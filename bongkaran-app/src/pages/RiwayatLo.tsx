import { useState } from 'react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { LO_STATUS, loStatus, loStatusMeta, planSupply, type LoDisplayStatus } from '@/lib/plan'
import type { Plan, PlanLo, ReportSummary } from '@/lib/sop'

type Row = { plan: Plan; lo: PlanLo; status: LoDisplayStatus; report: ReportSummary | undefined }

const COLS: Col<Row>[] = [
  { header: 'Tanggal kirim', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.plan.tanggal)}</span>, mobile: 'sub' },
  {
    header: 'No LO',
    cell: (x) => (
      <span className="tabular whitespace-nowrap">
        {x.lo.noLOLama && <s className="mr-1 text-on-surface-variant">{x.lo.noLOLama}</s>}
        {x.lo.noLO || <span className="italic text-on-surface-variant">belum terbit</span>}
      </span>
    ),
    mobile: 'title',
  },
  { header: 'BBM', cell: (x) => <ProdukChip produk={x.lo.produk} />, mobile: 'hide' },
  { header: 'Volume (L)', cell: (x) => formatNumber(x.lo.volume), align: 'right', mobile: 'hide' },
  {
    header: 'SO / Supply point',
    cell: (x) => (
      <span className="tabular">
        {x.plan.noSO ? `SO ${x.plan.noSO}` : 'SO belum terbit'}, {planSupply(x.plan, x.lo) || '-'}
      </span>
    ),
    mobile: 'sub',
  },
  { header: 'Produk', cell: (x) => `${x.lo.produk}, ${formatNumber(x.lo.volume)} L`, mobile: 'sub', desktop: false },
  { header: 'Nopol bongkar', cell: (x) => <span className="tabular whitespace-nowrap text-on-surface-variant">{x.report?.nopol || '-'}</span>, mobile: 'hide' },
  {
    header: 'Status',
    cell: (x) => {
      const m = loStatusMeta(x.status)
      return <Pill tone={m.tone}>{m.label}</Pill>
    },
    mobile: 'badge',
  },
]

/** Laporan > Riwayat Tracking LO: perjalanan tiap LO dari permintaan sampai closed. */
export function RiwayatLo() {
  const app = useApp()
  const [range, setRange] = useDateRange('month')
  const [status, setStatus] = useState<'semua' | LoDisplayStatus>('semua')
  if (!app.loaded) return <Loading />

  const all: Row[] = app.plans
    .flatMap((plan) => plan.los.map((lo) => ({ plan, lo, status: loStatus(lo, app.usedLoIds), report: app.usedLoIds.get(lo.id) })))
    .sort((a, b) => b.plan.tanggal.localeCompare(a.plan.tanggal) || b.plan.createdAt - a.plan.createdAt)
  const inDate = all.filter((x) => inRange(x.plan.tanggal, range))
  const rows = status === 'semua' ? inDate : inDate.filter((x) => x.status === status)
  const n = (k: LoDisplayStatus) => inDate.filter((x) => x.status === k).length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="lo-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Status LO"
          value={status}
          onChange={setStatus}
          options={[{ value: 'semua' as const, label: `Semua ${inDate.length}` }, ...LO_STATUS.map((s) => ({ value: s.key, label: `${s.label} ${n(s.key)}` }))]}
        />
        {status !== 'semua' && <span className="text-body-sm text-on-surface-variant">{loStatusMeta(status).desc}.</span>}
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Tracking LO" rows={rows} total={all.length} cols={COLS} rowKey={(x) => x.lo.id} to={() => '/plan'} empty="Tidak ada LO pada rentang ini." />
      </div>
    </div>
  )
}
