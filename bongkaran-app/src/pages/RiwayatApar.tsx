import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { RecordTable, type Col } from '@/components/bongkaran/record-table'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { hasilCek, type AparCek } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'

type Row = { key: string; tanggal: string; petugas: string; u: AparCek; temuan: string[] }

const tipeLabel = (u: AparCek) => (u.tipe === 'apab' ? 'APAB' : u.cadangan ? 'APAR cadangan' : 'APAR')

const COLS: Col<Row>[] = [
  { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.tanggal)}</span>, mobile: 'sub' },
  { header: 'Kode', cell: (x) => <span className="tabular font-semibold">{x.u.kode || '-'}</span>, mobileCell: (x) => `${x.u.kode || '-'} (${tipeLabel(x.u)})`, mobile: 'title' },
  { header: 'Tipe', cell: (x) => tipeLabel(x.u), mobile: 'hide' },
  { header: 'Jenis & kapasitas', cell: (x) => <span className="whitespace-nowrap">{`${x.u.jenis}, ${x.u.kapasitasKg || '-'} kg`}</span>, mobile: 'hide' },
  { header: 'Lokasi', cell: (x) => x.u.lokasi || '-', mobile: 'sub' },
  { header: 'Temuan', cell: (x) => (x.temuan.length ? <span className="text-error">{x.temuan.join('; ')}</span> : <span className="text-on-surface-variant">-</span>), mobile: 'sub' },
  { header: 'Tindak lanjut', cell: (x) => x.u.catatan || '-', mobile: 'hide' },
  { header: 'Petugas', cell: (x) => x.petugas || '-', mobile: 'hide' },
  { header: 'Hasil', cell: (x) => (x.temuan.length ? <Pill tone="error">{x.temuan.length} temuan</Pill> : <Pill tone="success">Baik</Pill>), mobile: 'badge' },
]

/** Laporan > Riwayat Inspeksi APAR & APAB: satu baris per unit per inspeksi selesai. */
export function RiwayatApar() {
  const app = useApp()
  const navigate = useNavigate()
  const [range, setRange] = useDateRange('month')
  const [hasil, setHasil] = useState<'semua' | 'temuan'>('semua')

  const all = useMemo(
    () =>
      app.daily
        .filter((d): d is AparRecord => d.kind === 'apar' && !!d.data.selesaiAt)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
        .flatMap((r) => r.data.units.map((u) => ({ key: `${r.id}_${u.unitId}`, tanggal: r.tanggal, petugas: r.data.petugas, u, temuan: hasilCek(u).temuan.map((t) => t.label) }))),
    [app.daily],
  )
  if (!app.loaded) return <Loading />

  const inDate = all.filter((x) => inRange(x.tanggal, range))
  const rows = hasil === 'temuan' ? inDate.filter((x) => x.temuan.length) : inDate
  const nTemuan = inDate.filter((x) => x.temuan.length).length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="apar-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Hasil"
          value={hasil}
          onChange={setHasil}
          options={[
            { value: 'semua' as const, label: `Semua ${inDate.length}` },
            { value: 'temuan' as const, label: `Ada temuan ${nTemuan}` },
          ]}
        />
        <span className="text-body-sm text-on-surface-variant">Ketuk baris untuk membuka data & riwayat unit.</span>
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable
          title="Inspeksi APAR & APAB"
          rows={rows}
          total={all.length}
          cols={COLS}
          rowKey={(x) => x.key}
          onRow={(x) => navigate(`/apar/unit/${encodeURIComponent(x.u.unitId)}`)}
          empty="Belum ada inspeksi selesai pada rentang ini."
        />
      </div>
    </div>
  )
}
