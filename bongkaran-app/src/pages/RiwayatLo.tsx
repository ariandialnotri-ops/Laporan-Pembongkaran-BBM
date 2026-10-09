import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRangeOrUpcoming, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { BARIS_BARU, BARIS_ORANYE, ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { belumTerbit, LO_STATUS, loStatus, loStatusMeta, planSupply, type LoDisplayStatus } from '@/lib/plan'
import type { Plan, PlanLo, ReportSummary } from '@/lib/sop'

type Row = { plan: Plan; lo: PlanLo; status: LoDisplayStatus; report: ReportSummary | undefined }

const COLS: Col<Row>[] = [
  { header: 'Tgl permintaan kirim', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.plan.tanggal)}</span>, mobile: 'sub' },
  { header: 'No SO', cell: (x) => <span className="tabular whitespace-nowrap">{x.plan.noSO || <span className="italic text-on-surface-variant">belum terbit</span>}</span>, mobile: 'hide' },
  {
    header: 'No LO',
    cell: (x) => (
      <span className="tabular whitespace-nowrap">
        {x.lo.noLOLama && <s className="mr-1 text-on-surface-variant">{x.lo.noLOLama}</s>}
        {x.lo.noLO || <span className="italic text-on-surface-variant">belum terbit</span>}
      </span>
    ),
    mobileCell: (x) => (x.lo.noLO ? `LO ${x.lo.noLO}` : 'LO belum terbit'),
    mobile: 'title',
  },
  { header: 'SO', cell: (x) => `SO ${x.plan.noSO || 'belum terbit'}`, mobile: 'sub', desktop: false },
  { header: 'Produk', cell: (x) => <ProdukChip produk={x.lo.produk} />, mobile: 'hide' },
  { header: 'Volume (L)', cell: (x) => formatNumber(x.lo.volume), align: 'right', mobile: 'hide' },
  { header: 'Produk & volume', cell: (x) => `${x.lo.produk}, ${formatNumber(x.lo.volume)} L${x.lo.shift ? `, shift ${x.lo.shift}` : ''}`, mobile: 'sub', desktop: false },
  { header: 'Supply point', cell: (x) => <span className="whitespace-nowrap">{planSupply(x.plan, x.lo) || '-'}</span>, mobile: 'sub' },
  { header: 'Nopol MT', cell: (x) => <span className="tabular whitespace-nowrap">{x.report?.nopol || '-'}</span>, mobile: 'hide' },
  {
    header: 'Status',
    cell: (x) => {
      const m = loStatusMeta(x.status)
      return (
        <Pill tone={m.tone}>
          {x.status === 'closed' && <Lock aria-hidden="true" />}
          {m.label}
        </Pill>
      )
    },
    mobile: 'badge',
  },
]

/** Laporan > Riwayat Tracking LO. Ketuk baris untuk membuka halaman Edit SO & LO; LO Closed terkunci. */
export function RiwayatLo() {
  const app = useApp()
  const [range, setRange] = useDateRange('month')
  const [status, setStatus] = useState<'semua' | LoDisplayStatus>('semua')
  const navigate = useNavigate()
  const baru = useSearchParams()[0].get('baru')
  useSyncOnOpen()
  if (!app.loaded) return <Loading />

  const all: Row[] = app.plans
    .flatMap((plan) => plan.los.map((lo) => ({ plan, lo, status: loStatus(lo, app.usedLoIds), report: app.usedLoIds.get(lo.id) })))
    .sort((a, b) => b.plan.tanggal.localeCompare(a.plan.tanggal) || b.plan.createdAt - a.plan.createdAt)
  const inDate = all.filter((x) => inRangeOrUpcoming(x.plan.tanggal, range))
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
        <span className="text-body-sm text-on-surface-variant">
          {status !== 'semua' ? `${loStatusMeta(status).desc}. ` : ''}Baris oranye: SO/LO belum terbit. Plan dengan tanggal kirim mendatang selalu tampil. Ketuk baris untuk mengubah LO. LO Closed tidak dapat diubah.
        </span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Tracking LO" rows={rows} total={all.length} cols={COLS} rowKey={(x) => x.lo.id} rowClass={(x) => (x.plan.id === baru ? BARIS_BARU : belumTerbit(x.plan, x.lo) ? BARIS_ORANYE : undefined)} onRow={(x) => navigate(`/plan/so/${encodeURIComponent(x.plan.id)}?lo=${encodeURIComponent(x.lo.id)}&dari=/laporan/lo`)} empty="Tidak ada LO pada rentang ini." />
      </div>
    </div>
  )
}
