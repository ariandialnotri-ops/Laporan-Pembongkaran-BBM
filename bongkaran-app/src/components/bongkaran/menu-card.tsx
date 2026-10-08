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
  /** Ada yang perlu dikerjakan: status tampil merah dengan jumlah. */
  badge?: number
}

// Animasi masuk berurutan; ditulis lengkap agar terbaca Tailwind.
const ENTRANCE = ['animate-entrance-2', 'animate-entrance-2', 'animate-entrance-3', 'animate-entrance-3', 'animate-entrance-4', 'animate-entrance-4']

/** Kartu menu di halaman Input dan Laporan. */
export function MenuCard({ m, index = 0 }: { m: MenuItem; index?: number }) {
  const Icon = m.icon
  return (
    <Link to={m.to} className={cn('glass-2 rim-light flex min-h-44 flex-col gap-space-sm rounded-lg p-space-md transition-transform duration-200 active:scale-[0.98]', ENTRANCE[index])}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
          <Icon className="size-5" />
        </span>
        {!!m.badge && (
          <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-error px-1.5 text-body-sm font-bold text-on-error" aria-label={`${m.badge} perlu dikerjakan`}>
            {m.badge}
          </span>
        )}
      </div>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body-md font-bold leading-tight text-on-surface">{m.title}</span>
        <span className="text-body-sm leading-snug text-on-surface-variant">{m.desc}</span>
      </span>
      <span className={cn('text-body-sm font-semibold leading-snug', m.badge ? 'text-error' : 'text-primary')}>{m.status}</span>
    </Link>
  )
}

