import { Link } from 'react-router-dom'
import { Ban, Check, ChevronRight, CircleCheck } from 'lucide-react'
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
        {!!h.nozzle?.length && <span className="font-semibold text-on-surface">Nozzle berhenti: {h.nozzle.join(', ')}</span>}
        <span className="tabular text-on-surface-variant">
          {labelWaktu(h.mulai, formatTanggalIso)} – {h.selesai ? labelWaktu(h.selesai, formatTanggalIso) : 'sekarang'} · {durasiHenti(h)}
        </span>
      </span>
    </div>
  )
}

/**
 * Centang nozzle yang berhenti untuk setiap produk terpilih (dari database nozzle). Nozzle produk yang baru
 * dipilih otomatis tercentang semua; petugas melepas centang nozzle yang masih menyalurkan.
 */
export function PilihNozzle({ produk, nozzles, value, onChange }: { produk: string[]; nozzles: { id: string; nama: string; produk: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const grup = produk.map((p) => ({ produk: p, list: nozzles.filter((n) => n.produk === p) })).filter((g) => g.list.length)
  if (!grup.length) return null
  return (
    <div className="flex flex-col gap-space-sm">
      {grup.map((g) => {
        const semua = g.list.every((n) => value.includes(n.id))
        return (
          <div key={g.produk} role="group" aria-label={`Nozzle ${g.produk} yang berhenti`} className="flex flex-col gap-space-xs rounded-md bg-error-container/30 p-space-sm">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="text-body-sm font-bold text-on-surface">
                Nozzle {g.produk} yang berhenti ({g.list.filter((n) => value.includes(n.id)).length}/{g.list.length})
              </span>
              <button
                type="button"
                className="touch-44 text-body-sm font-semibold text-primary"
                onClick={() => onChange(semua ? value.filter((v) => !g.list.some((n) => n.id === v)) : [...new Set([...value, ...g.list.map((n) => n.id)])])}
              >
                {semua ? 'Lepas semua' : 'Centang semua'}
              </button>
            </div>
            <div className="flex flex-wrap gap-space-xs">
              {g.list.map((n) => {
                const on = value.includes(n.id)
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onChange(on ? value.filter((v) => v !== n.id) : [...value, n.id])}
                    className={cn('flex min-h-11 items-center gap-1.5 rounded-md border-2 px-space-sm text-body-sm font-semibold transition-colors', on ? 'border-error bg-error text-on-error' : 'border-outline-variant bg-surface-container-lowest text-on-surface')}
                  >
                    <span aria-hidden="true" className={cn('flex size-5 items-center justify-center rounded border-2', on ? 'border-on-error bg-on-error text-error' : 'border-outline')}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    Nozzle {n.nama}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
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
