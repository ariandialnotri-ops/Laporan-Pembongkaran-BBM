import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, TriangleAlert, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { kepatuhanBulanan, NAMA_BULAN, type BulanKepatuhan, type StatusBulan } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { cn } from '@/lib/utils'

const GAYA: Record<StatusBulan, { kotak: string; label: string }> = {
  baik: { kotak: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', label: 'Diinspeksi, baik' },
  temuan: { kotak: 'bg-error-container/70 text-error ring-1 ring-error/30', label: 'Diinspeksi, ada temuan' },
  terlewat: { kotak: 'border-2 border-dashed border-error/50 bg-white text-error', label: 'Terlewat, tidak diinspeksi' },
  berjalan: { kotak: 'bg-amber-50 text-amber-700 ring-1 ring-amber-300', label: 'Bulan ini, belum diinspeksi' },
  nanti: { kotak: 'text-on-surface-variant', label: 'Bulan mendatang' },
  sebelum: { kotak: 'text-outline', label: 'Sebelum unit terdaftar' },
}

function Ikon({ status }: { status: StatusBulan }) {
  if (status === 'baik') return <Check aria-hidden="true" className="size-4" strokeWidth={3} />
  if (status === 'temuan') return <TriangleAlert aria-hidden="true" className="size-4" />
  if (status === 'terlewat') return <X aria-hidden="true" className="size-4" strokeWidth={3} />
  if (status === 'berjalan') return <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
  return <span aria-hidden="true" className="h-4" />
}

/**
 * Kalender kepatuhan inspeksi bulanan satu unit APAR/APAB (pengganti paraf/stamp HSE di kartu
 * tabung). Data setahun diambil dari server agar bulan di luar 120 hari terakhir ikut tampil.
 */
export function KalenderKepatuhan({ unitId }: { unitId: string }) {
  const app = useApp()
  const today = todayIso()
  const tahunIni = Number(today.slice(0, 4))
  const [tahun, setTahun] = useState(tahunIni)
  const [setahun, setSetahun] = useState<AparRecord[]>([])
  const [pilih, setPilih] = useState<number | null>(null)

  useEffect(() => {
    let hidup = true
    app.backend.listApar(`${tahun}-01-01`, `${tahun}-12-31`).then(
      (r) => hidup && setSetahun(r.filter((d): d is AparRecord => d.kind === 'apar')),
      () => hidup && setSetahun([]),
    )
    return () => {
      hidup = false
    }
  }, [tahun, app.backend])

  // Gabungan data lokal terbaru (termasuk kiriman barusan) dan data setahun dari server.
  const records = useMemo(() => {
    const m = new Map<string, AparRecord>()
    for (const r of setahun) m.set(r.id, r)
    for (const d of app.daily) if (d.kind === 'apar' && d.tanggal.startsWith(String(tahun))) m.set(d.id, d)
    return [...m.values()]
  }, [setahun, app.daily, tahun])

  const k = kepatuhanBulanan(unitId, records, tahun, today)
  const persen = k.wajib ? Math.round((k.patuh / k.wajib) * 100) : null
  const dipilih: BulanKepatuhan | null = pilih === null ? null : k.bulan[pilih]

  return (
    <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
      <div className="flex items-center gap-space-xs">
        <span className="flex-1 text-tag uppercase text-on-surface-variant">Matriks inspeksi bulanan</span>
        <button type="button" aria-label="Tahun sebelumnya" onClick={() => (setTahun(tahun - 1), setPilih(null))} className="flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <span className="tabular w-12 text-center text-body-md font-bold text-on-surface">{tahun}</span>
        <button
          type="button"
          aria-label="Tahun berikutnya"
          disabled={tahun >= tahunIni}
          onClick={() => (setTahun(tahun + 1), setPilih(null))}
          className="flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>

      <ol aria-label={`Kalender kepatuhan inspeksi ${tahun}`} className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {k.bulan.map((b) => {
          const g = GAYA[b.status]
          return (
            <li key={b.bulan}>
              <button
                type="button"
                aria-pressed={pilih === b.bulan}
                aria-label={`${NAMA_BULAN[b.bulan]} ${tahun}: ${g.label}${b.inspeksi ? `, ${formatTanggalIso(b.inspeksi.tanggal)}` : ''}`}
                onClick={() => setPilih(pilih === b.bulan ? null : b.bulan)}
                className={cn('flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md text-body-sm font-bold transition-transform active:scale-95', g.kotak, pilih === b.bulan && 'outline outline-2 outline-primary')}
              >
                <span className="tracking-wide">{NAMA_BULAN[b.bulan]}</span>
                <Ikon status={b.status} />
              </button>
            </li>
          )
        })}
      </ol>

      {dipilih && (
        <span role="status" className="rounded-md bg-surface-container-low px-space-sm py-space-xs text-body-sm text-on-surface">
          <b>
            {NAMA_BULAN[dipilih.bulan]} {tahun}:
          </b>{' '}
          {dipilih.inspeksi
            ? `diperiksa ${formatTanggalIso(dipilih.inspeksi.tanggal)} oleh ${dipilih.inspeksi.petugas || '-'}${dipilih.inspeksi.temuan.length ? `, temuan: ${dipilih.inspeksi.temuan.join('; ')}` : ', semua butir baik'}`
            : GAYA[dipilih.status].label.toLowerCase()}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-x-space-sm gap-y-1 text-body-sm text-on-surface-variant">
        <span className="tabular font-semibold text-on-surface">{persen === null ? `Kepatuhan ${tahun}: belum ada bulan wajib` : `Kepatuhan ${tahun}: ${k.patuh} dari ${k.wajib} bulan (${persen}%)`}</span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-emerald-400" /> baik
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-error" /> temuan / terlewat
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-amber-400" /> bulan ini
        </span>
      </div>

      <div className="flex items-start gap-space-sm rounded-md border border-amber-300 bg-amber-50 p-space-sm">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <span className="text-body-sm font-semibold uppercase leading-snug text-on-surface">
          Periksa setiap 30 hari. Dilarang memindahkan, mencopot, atau memodifikasi posisi tabung tanpa otorisasi resmi tim K3 / HSE.
        </span>
      </div>
    </GlassCard>
  )
}
