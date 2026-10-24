import type { ReactNode } from 'react'
import { Check, ChevronRight, Clock, X, type LucideIcon } from 'lucide-react'
import { formatTanggalIso } from '@/lib/date'
import { cn } from '@/lib/utils'

/** selesai = hijau, aktif = biru (tahap terbaru/berjalan), nanti = abu, error = merah (ditolak/dihapus), info = cyan. */
export type NadaLangkah = 'selesai' | 'aktif' | 'nanti' | 'error' | 'info'

export interface Langkah {
  key: string
  judul: string
  /** Epoch ms atau ISO; kosong = belum ada waktu. */
  waktu?: number | string | null
  oleh?: string
  tag?: string
  /** Rincian tahap (teks, foto, lampiran). */
  isi?: ReactNode
  nada: NadaLangkah
  /** Aksi tahap terbaru (mis. tindak lanjut / persetujuan): seluruh kartu dapat diketuk. */
  aksi?: { label: string; icon?: LucideIcon; onClick: () => void }
  /** Teks waktu bila tahap belum terjadi, mis. "Menunggu ABH". */
  kosong?: string
}

const BLN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
const keDate = (w: Langkah['waktu']) => {
  if (w === undefined || w === null || w === '') return null
  // "YYYY-MM-DDTHH:mm" tanpa zona dibaca sebagai waktu lokal.
  const d = new Date(w)
  return Number.isNaN(d.getTime()) ? null : d
}
const isoLokal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const labelWaktuLangkah = (d: Date) => `${formatTanggalIso(isoLokal(d))}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`

const BULATAN: Record<NadaLangkah, string> = {
  selesai: 'bg-emerald-600 text-white',
  aktif: 'bg-primary text-on-primary ring-4 ring-primary/20',
  nanti: 'bg-surface-container-high text-on-surface-variant',
  error: 'bg-error text-on-error',
  info: 'bg-cyan-600 text-white',
}
const GARIS: Record<NadaLangkah, string> = {
  selesai: 'bg-emerald-500',
  aktif: 'bg-primary/40',
  nanti: 'bg-outline-variant/60',
  error: 'bg-error/50',
  info: 'bg-cyan-500',
}

/**
 * Stepper vertikal gaya timeline (Tracking LO, insiden, pengajuan anggaran, WBS): kolom kiri bulan + bulatan
 * tanggal dihubungkan garis berwarna, kartu kanan berisi judul tahap, tag, waktu · pelaku, dan rincian. Tahap
 * dengan `aksi` (status terbaru) disorot biru dan dapat diketuk untuk membuka form pop up.
 */
export function Stepper({ langkah, judul, className }: { langkah: Langkah[]; judul?: string; className?: string }) {
  const selesai = langkah.filter((l) => l.nada === 'selesai' || l.nada === 'info').length
  return (
    <section className={cn('flex flex-col', className)} aria-label={judul ?? 'Tahapan'}>
      {judul && (
        <h2 className="mb-space-sm flex items-center gap-2 text-body-md font-bold text-on-surface">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {judul}
          <span className="text-body-sm font-medium text-on-surface-variant">
            ({selesai}/{langkah.length})
          </span>
        </h2>
      )}
      <ol className="flex flex-col">
        {langkah.map((l, i) => {
          const d = keDate(l.waktu)
          const aktif = l.nada === 'aktif'
          const IkonAksi = l.aksi?.icon ?? ChevronRight
          return (
            <li key={l.key} className="flex gap-space-sm" aria-current={aktif ? 'step' : undefined}>
              <div className="flex w-11 shrink-0 flex-col items-center">
                <span className={cn('h-4 text-[11px] font-bold leading-4 tracking-wide', d ? (l.nada === 'error' ? 'text-error' : 'text-primary') : 'text-transparent')}>{d ? BLN[d.getMonth()] : '·'}</span>
                <span className={cn('tabular flex size-9 shrink-0 items-center justify-center rounded-full text-body-sm font-bold shadow-sm', BULATAN[l.nada])}>
                  {d ? String(d.getDate()).padStart(2, '0') : l.nada === 'error' ? <X aria-hidden="true" className="size-4" /> : l.nada === 'selesai' ? <Check aria-hidden="true" className="size-4" /> : i + 1}
                </span>
                {i < langkah.length - 1 && <span aria-hidden="true" className={cn('my-1 w-0.5 flex-1 rounded-full', GARIS[l.nada])} />}
              </div>
              <div
                onClick={l.aksi?.onClick}
                className={cn(
                  'mb-space-sm mt-4 flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border p-space-sm transition-colors',
                  aktif ? 'border-primary/40 bg-primary/5' : l.nada === 'error' ? 'border-error/30 bg-error-container/20' : 'border-outline-variant/40 bg-surface-container-lowest',
                  l.nada === 'nanti' && 'opacity-70',
                  l.aksi && 'cursor-pointer hover:bg-primary/10 active:scale-[0.99]',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-body-md font-bold text-on-surface">{l.judul}</span>
                  {l.tag && <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', l.nada === 'error' ? 'bg-error-container text-on-error-container' : l.nada === 'selesai' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary/10 text-primary')}>{l.tag}</span>}
                </span>
                <span className="tabular flex flex-wrap items-center gap-1 text-xs font-semibold text-on-surface-variant">
                  <Clock aria-hidden="true" className="size-3.5" />
                  {d ? labelWaktuLangkah(d) : (l.kosong ?? (aktif ? 'Sedang berjalan' : l.nada === 'nanti' ? 'Belum' : 'Waktu tidak tercatat'))}
                  {l.oleh && <span className="font-medium">· {l.oleh}</span>}
                </span>
                {l.isi && <div className="mt-0.5 flex flex-col gap-1 text-body-sm text-on-surface-variant">{l.isi}</div>}
                {l.aksi && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      l.aksi!.onClick()
                    }}
                    className="mt-space-xs flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-space-md text-body-sm font-bold text-on-primary shadow-sm active:scale-[0.98]"
                  >
                    <IkonAksi aria-hidden="true" className="size-4" />
                    {l.aksi.label}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
