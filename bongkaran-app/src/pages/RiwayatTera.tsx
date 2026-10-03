import { useMemo, useState } from 'react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { BEJANA_LIMIT_ML, bejanaStatus, type QqRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { cn } from '@/lib/utils'

type Row = { key: string; tanggal: string; shift: number; jam: string; nozzle: string; produk: string; ml: number | null; pumpTest: string; lewat: boolean }

const COLS: Col<Row>[] = [
  { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.tanggal)}</span>, mobile: 'sub' },
  { header: 'Shift', cell: (x) => <span className="tabular text-on-surface-variant">{x.shift}{x.jam ? `, ${x.jam}` : ''}</span>, mobile: 'hide' },
  { header: 'Nozzle', cell: (x) => x.nozzle, mobile: 'title' },
  { header: 'BBM', cell: (x) => <ProdukChip produk={x.produk} />, mobile: 'hide' },
  { header: 'Produk', cell: (x) => x.produk, mobile: 'title', desktop: false },
  {
    header: 'Selisih (ml)',
    cell: (x) => <span className={cn('tabular font-semibold', x.lewat && 'text-error')}>{x.ml === null ? '-' : formatSigned(x.ml, 0)}</span>,
    align: 'right',
    mobile: 'sub',
  },
  { header: 'Pump test (L)', cell: (x) => x.pumpTest || '-', align: 'right', mobile: 'hide' },
  { header: 'Status', cell: (x) => (x.lewat ? <Pill tone="error">Di bawah batas</Pill> : <Pill tone="success">Sesuai</Pill>), mobile: 'badge' },
]

/** Laporan > Riwayat Tera: hasil bejana ukur 20 L per nozzle. */
export function RiwayatTera() {
  const app = useApp()
  const [range, setRange] = useDateRange('7d')
  const [hanyaLewat, setHanyaLewat] = useState<'semua' | 'lewat'>('semua')

  const all = useMemo(
    () =>
      app.daily
        .filter((d): d is QqRecord => d.kind === 'qq')
        .flatMap((rec) =>
          rec.data.kuantitas
            .filter((n) => n.selisihMl.trim())
            .map((n) => ({
              key: n.id,
              tanggal: rec.tanggal,
              shift: rec.shift,
              jam: rec.data.jam,
              nozzle: n.nozzle,
              produk: n.produk,
              ml: parseAngka(n.selisihMl),
              pumpTest: n.pumpTest,
              lewat: bejanaStatus(n.selisihMl) === 'lewat',
            })),
        )
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift || a.nozzle.localeCompare(b.nozzle)),
    [app.daily],
  )

  if (!app.loaded) return <Loading />

  const inDate = all.filter((x) => inRange(x.tanggal, range))
  const rows = hanyaLewat === 'lewat' ? inDate.filter((x) => x.lewat) : inDate
  const lewat = inDate.filter((x) => x.lewat).length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="tera-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Saring hasil"
          value={hanyaLewat}
          onChange={setHanyaLewat}
          options={[
            { value: 'semua' as const, label: `Semua ${inDate.length}` },
            { value: 'lewat' as const, label: `Di bawah batas ${lewat}` },
          ]}
        />
        <span className="text-body-sm text-on-surface-variant">Batas bejana ukur 20 L: {formatNumber(BEJANA_LIMIT_ML)} ml. Di bawah batas berarti nozzle perlu ditera ulang.</span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Tera Nozzle" rows={rows} total={all.length} cols={COLS} rowKey={(x) => x.key} empty="Belum ada uji tera pada rentang ini." />
      </div>
    </div>
  )
}
