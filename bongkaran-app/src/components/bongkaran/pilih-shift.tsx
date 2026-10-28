import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Field } from '@/components/bongkaran/form-bits'
import { KartuPilih, LegendaStatus, TitikStatus } from '@/components/bongkaran/pilih-status'
import { Input } from '@/components/ui/input'
import { addDays, formatTanggalIso, hariSingkat, todayIso } from '@/lib/date'
import { currentShift, SHIFTS, type Shift } from '@/lib/shift'
import type { StatusIsi } from '@/lib/status-isi'
import { cn } from '@/lib/utils'

export type KunciShift = { tanggal: string; shift: Shift }

/**
 * Menu input per shift: pilih tanggal (strip 7 hari dengan titik status tiap shift),
 * lalu pilih shift. Kartu shift berwarna hijau/oranye/merah dan membuka halaman form.
 */
export function PilihShift({
  status,
  keHalaman,
  keterangan,
}: {
  status: (k: KunciShift) => StatusIsi
  keHalaman: (k: KunciShift) => string
  /** Teks tambahan per shift, mis. "Sebagian tersimpan" atau nama petugas. */
  keterangan?: (k: KunciShift, s: StatusIsi) => string | undefined
}) {
  const now = currentShift()
  const [tanggal, setTanggal] = useState(now.tanggal)
  const dasar = new Date(`${now.tanggal}T00:00:00`)
  // Hari ini paling kiri, mundur 6 hari ke kanan.
  const hari = Array.from({ length: 7 }, (_, i) => todayIso(addDays(dasar, -i)))
  return (
    <div className="flex flex-col gap-space-md">
      <div className="animate-entrance-1 -mx-margin overflow-x-auto px-margin pb-1">
        <div role="radiogroup" aria-label="Tanggal" className="flex min-w-max gap-space-xs">
          {hari.map((t) => {
            const d = new Date(`${t}T00:00:00`)
            const aktif = t === tanggal
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setTanggal(t)}
                className={cn(
                  'flex w-14 flex-col items-center gap-1 rounded-[14px] py-2 transition-colors',
                  aktif ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-lowest/80 text-on-surface',
                )}
              >
                <span className={cn('text-xs uppercase', aktif ? 'text-on-primary/80' : 'text-on-surface-variant')}>{hariSingkat(d)}</span>
                <span className="tabular text-body-md font-bold">{d.getDate()}</span>
                <span className={cn('flex gap-1 rounded-full px-1 py-0.5', aktif && 'bg-white/90')}>
                  {SHIFTS.map((s) => {
                    const st = status({ tanggal: t, shift: s.no })
                    return <TitikStatus key={s.no} status={st} label={`${s.label}: ${st}`} />
                  })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-end justify-between gap-space-sm">
        <span className="px-space-xs text-headline-md font-bold text-on-surface">{formatTanggalIso(tanggal)}</span>
        <Field label="Tanggal lain" htmlFor="pilih-tgl" className="w-40">
          <Input id="pilih-tgl" type="date" max={now.tanggal} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
        </Field>
      </div>

      <div className="animate-entrance-2 flex flex-col gap-space-sm">
        {SHIFTS.map((s) => {
          const k = { tanggal, shift: s.no }
          const st = status(k)
          const kini = tanggal === now.tanggal && s.no === now.shift
          return (
            <KartuPilih
              key={s.no}
              to={keHalaman(k)}
              status={st}
              judul={`${s.label}${kini ? ' · berjalan' : ''}`}
              sub={s.jam}
              keterangan={keterangan?.(k, st)}
            />
          )
        })}
      </div>
      <LegendaStatus nanti />
    </div>
  )
}

/** Tanggal & shift dari alamat halaman (/stok/:tanggal/:shift, /kualitas/:tanggal/:shift). */
export function useKunciShift() {
  const p = useParams()
  const tanggal = p.tanggal ?? ''
  const shift = Number(p.shift) as Shift
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && SHIFTS.some((s) => s.no === shift)
  return { tanggal, shift, valid }
}

