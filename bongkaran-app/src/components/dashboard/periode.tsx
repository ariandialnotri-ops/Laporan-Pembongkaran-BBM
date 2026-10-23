import { useState } from 'react'
import { Check, ChevronDown, Funnel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import type { Periode } from '@/lib/kpi'
import { cn } from '@/lib/utils'

export type PresetPeriode = '7h' | '30h' | 'bulan' | 'bulanLalu' | '3bulan' | 'custom'
export interface PeriodeDashboard extends Periode {
  preset: PresetPeriode
}

const PRESET: { key: Exclude<PresetPeriode, 'custom'>; label: string }[] = [
  { key: '7h', label: '7 hari terakhir' },
  { key: '30h', label: '30 hari terakhir' },
  { key: 'bulan', label: 'Bulan ini' },
  { key: 'bulanLalu', label: 'Bulan lalu' },
  { key: '3bulan', label: '3 bulan terakhir' },
]

export function periodeDari(preset: Exclude<PresetPeriode, 'custom'>, now = new Date()): PeriodeDashboard {
  const hari = todayIso(now)
  const mundur = (n: number) => todayIso(addDays(now, -n))
  if (preset === '7h') return { preset, dari: mundur(6), sampai: hari }
  if (preset === '30h') return { preset, dari: mundur(29), sampai: hari }
  if (preset === 'bulanLalu') {
    const a = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { preset, dari: todayIso(a), sampai: todayIso(new Date(now.getFullYear(), now.getMonth(), 0)) }
  }
  if (preset === '3bulan') return { preset, dari: todayIso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), sampai: hari }
  return { preset, dari: `${hari.slice(0, 8)}01`, sampai: hari }
}

export const labelPeriode = (p: PeriodeDashboard) => (p.preset === 'custom' ? `${formatTanggalIso(p.dari)} – ${formatTanggalIso(p.sampai)}` : (PRESET.find((x) => x.key === p.preset)?.label ?? ''))

/** Rentang ringkas: "1 – 23 Okt 2026" bila sebulan, tahun ditulis sekali bila sama. */
const rentangRingkas = (p: Periode) => {
  const a = formatTanggalIso(p.dari).split(' ')
  const b = formatTanggalIso(p.sampai).split(' ')
  if (a[2] !== b[2]) return `${a.join(' ')} – ${b.join(' ')}`
  return a[1] === b[1] ? `${a[0]} – ${b.join(' ')}` : `${a[0]} ${a[1]} – ${b.join(' ')}`
}

/** Tombol "Filter Tanggal" (ikon corong) periode tarikan dashboard + bottom sheet pilihan & rentang bebas. */
export function PilihPeriode({ value, onChange, className }: { value: PeriodeDashboard; onChange: (p: PeriodeDashboard) => void; className?: string }) {
  const [buka, setBuka] = useState(false)
  const [dari, setDari] = useState(value.dari)
  const [sampai, setSampai] = useState(value.sampai)
  const hari = todayIso()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDari(value.dari)
          setSampai(value.sampai)
          setBuka(true)
        }}
        aria-label={`Filter tanggal: ${labelPeriode(value)}, ${rentangRingkas(value)}. Ubah periode`}
        aria-expanded={buka}
        className={cn(
          'group flex min-h-12 items-center gap-space-sm rounded-xl bg-surface-container-lowest py-1.5 shadow-sm pl-1.5 pr-space-sm text-left ring-1 ring-inset ring-outline-variant/50 transition-colors hover:bg-primary/5 active:scale-[0.98]',
          className,
        )}
      >
        <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm transition-transform duration-200 group-hover:scale-105 group-active:scale-90">
          <Funnel className="size-4" />
          {/* Titik: periode bukan bawaan (bulan ini). */}
          {value.preset !== 'bulan' && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-surface-container-lowest" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-on-surface-variant">Filter Tanggal</span>
          <span className="truncate text-body-sm font-bold text-on-surface">
            {labelPeriode(value)}
            {value.preset !== 'custom' && <span className="tabular font-medium text-on-surface-variant"> · {rentangRingkas(value)}</span>}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-on-surface-variant transition-transform duration-200', buka && 'rotate-180')} />
      </button>
      <Sheet open={buka} onOpenChange={setBuka} title="Filter Tanggal" description="Data grafik & KPI ditarik untuk periode ini">
        <div className="flex flex-col gap-space-sm pb-space-md">
          <div className="flex flex-col divide-y divide-outline-variant/40 rounded-lg bg-surface-container-low">
            {PRESET.map((p) => {
              const on = value.preset === p.key
              const r = periodeDari(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    onChange(r)
                    setBuka(false)
                  }}
                  className="flex min-h-14 items-center gap-space-sm px-space-md text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('text-body-md font-semibold', on ? 'text-primary' : 'text-on-surface')}>{p.label}</span>
                    <span className="tabular text-xs text-on-surface-variant">
                      {formatTanggalIso(r.dari)} – {formatTanggalIso(r.sampai)}
                    </span>
                  </span>
                  {on && <Check aria-hidden="true" className="size-5 text-primary" />}
                </button>
              )
            })}
          </div>
          <span className="px-space-xs text-tag uppercase text-on-surface-variant">Pilih tanggal sendiri</span>
          <div className="grid grid-cols-2 gap-space-sm">
            <Input type="date" aria-label="Dari tanggal" max={sampai || hari} value={dari} onChange={(e) => e.target.value && setDari(e.target.value)} />
            <Input type="date" aria-label="Sampai tanggal" min={dari} max={hari} value={sampai} onChange={(e) => e.target.value && setSampai(e.target.value)} />
          </div>
          <Button
            disabled={!dari || !sampai || dari > sampai}
            onClick={() => {
              onChange({ preset: 'custom', dari, sampai })
              setBuka(false)
            }}
          >
            Terapkan rentang
          </Button>
        </div>
      </Sheet>
    </>
  )
}

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Kelompokkan nilai per tanggal menjadi batang grafik untuk periode: per hari (≤ 31 hari; label nama hari bila
 * ≤ 7 hari) atau per minggu (periode lebih panjang). Periode yang belum terjadi tidak ditampilkan.
 */
export function kelompokPeriode(p: Periode, items: { tanggal: string; value: number }[]) {
  const akhir = p.sampai < todayIso() ? p.sampai : todayIso()
  const hari: string[] = []
  for (let t = p.dari; t <= akhir; t = todayIso(addDays(new Date(`${t}T00:00:00`), 1))) hari.push(t)
  const jumlah = new Map<string, number>()
  for (const x of items) if (x.tanggal >= p.dari && x.tanggal <= akhir) jumlah.set(x.tanggal, (jumlah.get(x.tanggal) ?? 0) + x.value)
  const tgl = (t: string) => new Date(`${t}T00:00:00`)
  if (hari.length <= 31)
    return hari.map((t) => ({ label: hari.length <= 7 ? HARI[tgl(t).getDay()] : String(Number(t.slice(8))), judul: formatTanggalIso(t), value: jumlah.get(t) ?? 0 }))
  const out: { label: string; judul: string; value: number }[] = []
  for (let i = 0; i < hari.length; i += 7) {
    const blok = hari.slice(i, i + 7)
    const a = tgl(blok[0])
    out.push({ label: `${a.getDate()} ${BLN[a.getMonth()]}`, judul: `${formatTanggalIso(blok[0])} – ${formatTanggalIso(blok[blok.length - 1])}`, value: blok.reduce((n, t) => n + (jumlah.get(t) ?? 0), 0) })
  }
  return out
}
