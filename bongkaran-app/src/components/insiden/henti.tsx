import { Link } from 'react-router-dom'
import { Ban, ChevronRight, CircleCheck } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { durasiHenti, hentiDari, labelMenit, labelWaktu, ringkasHenti, type HentiPenyaluran } from '@/lib/insiden'
import { cn } from '@/lib/utils'

/** Ringkasan pemberhentian penyaluran: produk, dari–sampai, lama. */
export function HentiInfo({ h }: { h: HentiPenyaluran }) {
  return (
    <div className={cn('flex items-start gap-space-sm rounded-md p-space-sm', h.selesai ? 'bg-surface-container-low' : 'bg-error-container/70')}>
      <Ban aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', h.selesai ? 'text-on-surface-variant' : 'text-error')} />
      <span className="flex flex-col text-body-sm">
        <b className={h.selesai ? 'text-on-surface' : 'text-on-error-container'}>
          {h.selesai ? 'Penyaluran sempat dihentikan' : 'Penyaluran dihentikan sementara'}: {h.produk.join(', ')}
        </b>
        <span className="tabular text-on-surface-variant">
          {labelWaktu(h.mulai, formatTanggalIso)} – {h.selesai ? labelWaktu(h.selesai, formatTanggalIso) : 'sekarang'} · {durasiHenti(h)}
        </span>
      </span>
    </div>
  )
}

/** Pilih beberapa produk (tombol toggle). */
export function PilihProduk({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  return (
    <div role="group" aria-label="Produk yang dihentikan" className="flex flex-wrap gap-space-xs">
      {options.map((p) => {
        const on = value.includes(p)
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            className={cn('min-h-10 rounded-full border px-space-sm text-body-sm font-semibold transition-colors', on ? 'border-error bg-error text-on-error' : 'border-outline-variant bg-surface-container-lowest text-on-surface')}
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}

/** Kartu dashboard: status penyaluran sekarang dan ringkasan stop penyaluran bulan ini. */
export function KartuStopPenyaluran({ className }: { className?: string }) {
  const app = useApp()
  const r = ringkasHenti(hentiDari(app.daily), todayIso().slice(0, 7))
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', r.aktif.length > 0 && 'ring-1 ring-error/40', className)}>
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', r.aktif.length ? 'bg-error-container text-error' : 'bg-emerald-100 text-emerald-700')}>
          {r.aktif.length ? <Ban className="size-5" /> : <CircleCheck className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">Status penyaluran</span>
          <span className="text-body-sm text-on-surface-variant">
            {r.aktif.length ? `${r.aktif.length} stop penyaluran masih berjalan` : 'Semua produk tersalurkan normal'} · {r.kejadian} kejadian bulan ini
          </span>
        </div>
        <Link to="/stop-penyaluran" className="touch-44 flex shrink-0 items-center gap-0.5 text-body-sm font-semibold text-primary">
          Dashboard
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {r.aktif.map((x) => (
        <Link key={x.id} to={`/laporan/insiden/${encodeURIComponent(x.id)}`}>
          <HentiInfo h={x.h} />
        </Link>
      ))}
      {r.kejadian > 0 && (
        <span className="tabular text-body-sm text-on-surface-variant">
          Total berhenti bulan ini {labelMenit(r.totalMenit)}
          {r.rataMenit ? `, rata-rata ${labelMenit(r.rataMenit)} per kejadian` : ''}
        </span>
      )}
    </GlassCard>
  )
}
