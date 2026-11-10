import { useState } from 'react'
import { KartuPilih, LegendaStatus, TitikStatus } from '@/components/bongkaran/pilih-status'
import { addDays, formatTanggalIso, hariSingkat, todayIso } from '@/lib/date'
import { BATAS_HARIAN } from '@/lib/harian'
import type { StatusIsi } from '@/lib/status-isi'
import { cn } from '@/lib/utils'

/**
 * Menu pemeriksaan sekali sehari (shift 1, paling lambat 10:00): strip 7 hari dengan titik status,
 * lalu satu kartu untuk tanggal terpilih. Hanya hari ini yang dapat diisi; hari lalu tampil saja.
 */
export function PilihHarian({
  status,
  keHalaman,
  judul,
  keterangan,
}: {
  status: (tanggal: string) => StatusIsi
  keHalaman: (tanggal: string) => string
  judul: string
  keterangan?: (tanggal: string, s: StatusIsi) => string | undefined
}) {
  const hariIni = todayIso()
  const [tanggal, setTanggal] = useState(hariIni)
  const dasar = new Date(`${hariIni}T00:00:00`)
  const hari = Array.from({ length: 7 }, (_, i) => todayIso(addDays(dasar, -i)))
  const st = status(tanggal)
  const bisaIsi = tanggal === hariIni
  return (
    <div className="flex flex-col gap-space-md">
      <div className="animate-entrance-1 -mx-margin overflow-x-auto px-margin pb-1">
        <div role="radiogroup" aria-label="Tanggal" className="flex min-w-max gap-space-xs">
          {hari.map((t) => {
            const d = new Date(`${t}T00:00:00`)
            const aktif = t === tanggal
            const s = status(t)
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setTanggal(t)}
                className={cn('flex w-14 flex-col items-center gap-1 rounded-[14px] py-2 transition-colors', aktif ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-lowest/80 text-on-surface')}
              >
                <span className={cn('text-xs uppercase', aktif ? 'text-on-primary/80' : 'text-on-surface-variant')}>{hariSingkat(d)}</span>
                <span className="tabular text-body-md font-bold">{d.getDate()}</span>
                <span className={cn('flex rounded-full px-1 py-0.5', aktif && 'bg-white/90')}>
                  <TitikStatus status={s} label={`${formatTanggalIso(t)}: ${s}`} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="animate-entrance-2 flex flex-col gap-space-sm">
        <KartuPilih
          to={keHalaman(tanggal)}
          status={st}
          statis={!bisaIsi}
          judul={`${judul} · ${formatTanggalIso(tanggal)}`}
          sub={`Shift 1 · paling lambat ${BATAS_HARIAN}${bisaIsi ? '' : ' · hanya dapat diisi pada hari yang sama'}`}
          keterangan={keterangan?.(tanggal, st)}
        />
      </div>
      <LegendaStatus />
    </div>
  )
}
