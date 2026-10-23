import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MenuItem = {
  to: string
  icon: LucideIcon
  title: string
  desc: string
  /** Kondisi saat ini, mis. "2 berjalan". */
  status: string
  /** Jumlah yang perlu dikerjakan (lencana). */
  badge?: number
  /**
   * Nada status: ok = biru (beres/info), pengingat = amber (belum dikerjakan), anomali = merah (gagal,
   * melewati batas, penyaluran berhenti). Bawaan: pengingat bila ada lencana, selain itu ok.
   */
  nada?: NadaStatus
}

export type NadaStatus = 'ok' | 'pengingat' | 'anomali'
const nadaItem = (m: Pick<MenuItem, 'nada' | 'badge'>): NadaStatus => m.nada ?? (m.badge ? 'pengingat' : 'ok')
const LENCANA: Record<NadaStatus, string> = { ok: 'bg-primary text-on-primary', pengingat: 'bg-amber-400 text-amber-950', anomali: 'bg-error text-on-error' }
const TEKS: Record<NadaStatus, string> = { ok: 'text-primary', pengingat: 'text-amber-800', anomali: 'text-error' }

// Animasi masuk berurutan; ditulis lengkap agar terbaca Tailwind.
const ENTRANCE = ['animate-entrance-2', 'animate-entrance-2', 'animate-entrance-3', 'animate-entrance-3', 'animate-entrance-4', 'animate-entrance-4']

/** Kartu menu di halaman Input dan Laporan. */
export function MenuCard({ m, index = 0 }: { m: MenuItem; index?: number }) {
  const Icon = m.icon
  const nada = nadaItem(m)
  return (
    <Link to={m.to} className={cn('glass-2 rim-light flex min-h-44 flex-col gap-space-sm rounded-lg p-space-md transition-transform duration-200 active:scale-[0.98]', ENTRANCE[index])}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
          <Icon className="size-5" />
        </span>
        {!!m.badge && (
          <span className={cn('tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-body-sm font-bold', LENCANA[nada])} aria-label={`${m.badge} ${nada === 'anomali' ? 'anomali' : 'perlu dikerjakan'}`}>
            {m.badge}
          </span>
        )}
      </div>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body-md font-bold leading-tight text-on-surface">{m.title}</span>
        <span className="text-body-sm leading-snug text-on-surface-variant">{m.desc}</span>
      </span>
      <span className={cn('text-body-sm font-semibold leading-snug', TEKS[nada])}>{m.status}</span>
    </Link>
  )
}

