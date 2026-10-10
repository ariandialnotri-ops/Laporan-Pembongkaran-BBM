import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'

/** Kartu ringkas di Dashboard ABH: jumlah unit bisnis & tautan ke Dashboard Unit Bisnis. */
export function KartuUnitBisnis() {
  const app = useApp()
  if (!app.isAdmin) return null
  return (
    <GlassCard level={2} className="animate-entrance-1">
      <Link to="/unit" className="flex min-h-14 items-center gap-space-sm px-space-md py-space-sm">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <Building2 className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-md font-semibold text-on-surface">Unit bisnis: {app.spbuList.length} SPBU</span>
        <span className="truncate text-body-sm text-on-surface-variant">Progres semua SPBU, tambah SPBU, ganti SPBU aktif</span>
      </span>
      <span className={buttonVariants({ variant: 'soft', size: 'sm' })}>Buka</span>
      </Link>
    </GlassCard>
  )
}
