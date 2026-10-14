import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleAlert, CircleCheck, CircleDashed, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusIsi } from '@/lib/status-isi'

export type { StatusIsi }

const GAYA: Record<StatusIsi, { kartu: string; ikon: string; label: string; Ikon: typeof CircleCheck }> = {
  sudah: { kartu: 'border-emerald-300 bg-emerald-50', ikon: 'bg-emerald-600 text-white', label: 'text-emerald-800', Ikon: CircleCheck },
  belum: { kartu: 'border-orange-300 bg-orange-50', ikon: 'bg-orange-500 text-white', label: 'text-orange-800', Ikon: Clock },
  terlewat: { kartu: 'border-red-300 bg-red-50', ikon: 'bg-red-600 text-white', label: 'text-red-800', Ikon: CircleAlert },
  nanti: { kartu: 'border-outline-variant/60 bg-surface-container-low/70 opacity-70', ikon: 'bg-surface-container-high text-on-surface-variant', label: 'text-on-surface-variant', Ikon: CircleDashed },
}

export const LABEL_STATUS: Record<StatusIsi, string> = { sudah: 'Sudah diisi', belum: 'Belum diisi', terlewat: 'Terlewat', nanti: 'Belum waktunya' }

/** Kartu pilihan berwarna status yang membuka halaman form. */
export function KartuPilih({
  to,
  status,
  judul,
  sub,
  keterangan,
  className,
  statis = false,
}: {
  /** Tanpa tautan (mis. unit APAR yang harus dibuka lewat pindai QR di lokasi). */
  statis?: boolean
  to: string
  status: StatusIsi
  judul: ReactNode
  sub?: ReactNode
  /** Teks status; bawaan dari LABEL_STATUS. */
  keterangan?: ReactNode
  className?: string
}) {
  const g = GAYA[status]
  const isi = (
    <>
      <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', g.ikon)}>
        <g.Ikon className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-md font-bold text-on-surface">{judul}</span>
        {sub && <span className="truncate text-body-sm text-on-surface-variant">{sub}</span>}
        <span className={cn('text-body-sm font-semibold', g.label)}>{keterangan ?? LABEL_STATUS[status]}</span>
      </span>
      {status !== 'nanti' && !statis && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />}
    </>
  )
  const kelas = cn('flex min-h-20 items-center gap-space-sm rounded-lg border p-space-sm text-left', g.kartu, className)
  if (status === 'nanti' || statis)
    return (
      <div aria-disabled={status === 'nanti' || undefined} className={kelas}>
        {isi}
      </div>
    )
  return (
    <Link to={to} className={cn(kelas, 'transition-transform active:scale-[0.99]')}>
      {isi}
    </Link>
  )
}

/** Keterangan warna status. */
export function LegendaStatus({ nanti = false }: { nanti?: boolean }) {
  const daftar: StatusIsi[] = nanti ? ['sudah', 'belum', 'terlewat', 'nanti'] : ['sudah', 'belum', 'terlewat']
  return (
    <div className="flex flex-wrap gap-x-space-sm gap-y-1 px-space-xs text-body-sm text-on-surface-variant">
      {daftar.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-3 rounded-full', GAYA[s].ikon)} />
          {s === 'sudah' ? 'Sudah' : s === 'belum' ? 'Belum' : s === 'terlewat' ? 'Terlewat' : 'Belum waktunya'}
        </span>
      ))}
    </div>
  )
}

/** Titik warna status kecil (strip tanggal). */
export function TitikStatus({ status, label }: { status: StatusIsi; label: string }) {
  return <span role="img" aria-label={label} title={label} className={cn('size-2.5 rounded-full', GAYA[status].ikon)} />
}
