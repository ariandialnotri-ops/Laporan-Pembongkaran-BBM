import { useMemo, useState } from 'react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { qqD15, type QqRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { normalizeDensity } from '@/lib/density'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { acuanD15 } from '@/lib/ringkasan'
import { PRODUK_OPTIONS } from '@/lib/sop'

type Row = {
  key: string
  jenis: 'Uji harian' | 'Sample 2 jam'
  tanggal: string
  waktu: string
  produk: string
  density: number | null
  suhu: string
  d15: number | null
  acuan: string
  selisih: number | null
  ok: boolean | null
  to?: string
}

const COLS: Col<Row>[] = [
  { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.tanggal)}</span>, mobile: 'sub', desktop: true },
  { header: 'Waktu', cell: (x) => <span className="tabular whitespace-nowrap text-on-surface-variant">{x.waktu}</span>, mobile: 'hide' },
  { header: 'Jenis', cell: (x) => x.jenis, mobile: 'title' },
  { header: 'BBM', cell: (x) => <ProdukChip produk={x.produk} />, mobile: 'hide' },
  { header: 'Produk', cell: (x) => x.produk, mobile: 'title', desktop: false },
  { header: 'Density', cell: (x) => formatDensity(x.density), align: 'right', mobile: 'hide' },
  { header: 'Suhu (°C)', cell: (x) => x.suhu || '-', align: 'right', mobile: 'hide' },
  { header: 'D15', cell: (x) => <span className="font-semibold">{formatDensity(x.d15)}</span>, align: 'right', mobile: 'hide' },
  {
    header: 'Hasil',
    cell: (x) => (
      <span className="tabular">
        D15 {formatDensity(x.d15)}, {x.acuan} {x.selisih !== null ? formatDensitySigned(x.selisih) : '-'}
      </span>
    ),
    mobile: 'sub',
    desktop: false,
  },
  { header: 'Acuan', cell: (x) => <span className="text-on-surface-variant">{x.acuan}</span>, mobile: 'hide' },
  { header: 'Selisih', cell: (x) => (x.selisih !== null ? formatDensitySigned(x.selisih) : '-'), align: 'right', mobile: 'hide' },
  {
    header: 'Status',
    cell: (x) => (x.ok === null ? <Pill>Tanpa acuan</Pill> : x.ok ? <Pill tone="success">Sesuai</Pill> : <Pill tone="error">Tidak sesuai</Pill>),
    mobile: 'badge',
  },
]

/** Laporan > Riwayat Kualitas Harian: uji density harian per shift dan sample BBM 2 jam setelah penerimaan. */
export function RiwayatKualitas() {
  const app = useApp()
  const [range, setRange] = useDateRange('7d')
  const [produk, setProduk] = useState('semua')
  const [jenis, setJenis] = useState<'semua' | Row['jenis']>('semua')

  const all = useMemo(() => {
    const tol = app.rules.densityTolerance + 1e-9
    const harian: Row[] = app.daily
      .filter((d): d is QqRecord => d.kind === 'qq')
      .flatMap((rec) =>
        rec.data.kualitas.map((k) => {
          const d15 = qqD15(k).d15?.value ?? null
          const ref = acuanD15(app.reports, k.produk, rec.tanggal)
          const selisih = d15 !== null && ref ? Math.round((d15 - ref.d15) * 10000) / 10000 : null
          return {
            key: k.id,
            jenis: 'Uji harian' as const,
            tanggal: rec.tanggal,
            waktu: `Shift ${rec.shift}${rec.data.jam ? `, ${rec.data.jam}` : ''}`,
            produk: k.produk,
            density: normalizeDensity(k.densityObs),
            suhu: k.suhu,
            d15,
            acuan: ref ? `bongkar ${formatTanggalIso(ref.tanggal)}` : 'belum ada bongkaran',
            selisih,
            ok: selisih !== null ? Math.abs(selisih) <= tol : null,
            to: '/kualitas',
          }
        }),
      )
    const sample: Row[] = app.reports
      .filter((r) => r.sample2Jam)
      .map((r) => ({
        key: `s_${r.id}`,
        jenis: 'Sample 2 jam' as const,
        tanggal: r.sample2Jam!.tanggal,
        waktu: `${r.sample2Jam!.jam}, ${r.nopol}`,
        produk: r.produk,
        density: null,
        suhu: '',
        d15: r.sample2Jam!.d15,
        acuan: 'D15 depot',
        selisih: r.sample2Jam!.selisih,
        ok: r.sample2Jam!.ok,
        to: `/input/${r.id}`,
      }))
    return [...harian, ...sample].sort((a, b) => (b.tanggal + b.waktu).localeCompare(a.tanggal + a.waktu))
  }, [app.daily, app.reports, app.rules.densityTolerance])

  if (!app.loaded) return <Loading />

  const rows = all.filter((x) => inRange(x.tanggal, range) && (produk === 'semua' || x.produk === produk) && (jenis === 'semua' || x.jenis === jenis))
  const tidak = rows.filter((x) => x.ok === false).length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="kualitas-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Jenis uji"
          value={jenis}
          onChange={setJenis}
          options={[
            { value: 'semua' as const, label: 'Semua uji' },
            { value: 'Uji harian' as const, label: 'Uji harian' },
            { value: 'Sample 2 jam' as const, label: 'Sample 2 jam' },
          ]}
        />
        <ChipFilter label="Produk" value={produk} onChange={setProduk} options={[{ value: 'semua', label: 'Semua produk' }, ...PRODUK_OPTIONS.map((p) => ({ value: p, label: p }))]} />
        <span className="tabular text-body-sm text-on-surface-variant">
          {rows.length} uji{tidak ? `, ${tidak} tidak sesuai toleransi ±${String(app.rules.densityTolerance).replace('.', ',')}` : ', semua sesuai'}
        </span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Kualitas Harian" rows={rows} total={all.length} cols={COLS} rowKey={(x) => x.key} to={(x) => x.to ?? '/kualitas'} empty="Belum ada uji kualitas pada rentang ini." />
      </div>
    </div>
  )
}
