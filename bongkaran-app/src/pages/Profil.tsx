import type { LucideIcon } from 'lucide-react'
import { Bell, CalendarDays, ChevronRight, CircleHelp, FileText, FlaskConical, Fuel, LogOut, MapPin, ShieldCheck, Truck, UserRound } from 'lucide-react'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { currentUser } from '@/data/mock'
import { countBongkaran, isLive, listLaporan } from '@/lib/api'
import { useQuery } from '@/lib/use-query'
import { cn } from '@/lib/utils'

async function loadStats() {
  if (!isLive) return currentUser.stats
  const [bongkaran, laporan] = await Promise.all([countBongkaran(), listLaporan(500)])
  const now = new Date()
  const bulanIni = laporan.filter((l) => {
    const d = new Date(l.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  return {
    validated: bongkaran.total,
    complianceRate: bongkaran.total > 0 ? `${Math.round((bongkaran.sesuai / bongkaran.total) * 100)}%` : '—',
    reportsThisMonth: bulanIni,
  }
}

export function Profil() {
  const [state] = useQuery(loadStats)
  const stats = state.status === 'ready' ? state.data : null
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col items-center gap-space-sm p-space-lg text-center">
        <span className="relative">
          <span
            aria-hidden="true"
            className="tabular flex size-20 items-center justify-center rounded-full bg-primary-fixed text-headline-lg font-bold text-on-primary-fixed shadow-sm ring-4 ring-white/80"
          >
            {currentUser.initials}
          </span>
          <span aria-hidden="true" className="absolute bottom-1 right-1 size-4 rounded-full bg-tertiary-container shadow ring-2 ring-white" />
        </span>
        <div className="flex flex-col items-center gap-space-xs">
          <span className="text-headline-lg font-bold text-on-surface">{currentUser.name}</span>
          <div className="flex flex-wrap justify-center gap-space-xs">
            <Pill tone="primary">{currentUser.role}</Pill>
            <Pill tone="info">
              <ShieldCheck aria-hidden="true" className="text-tertiary" />
              Terverifikasi
            </Pill>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <MapPin aria-hidden="true" className="size-4 text-primary" />
          {currentUser.coverage}
        </span>
      </GlassCard>

      <section aria-labelledby="statistik" className="animate-entrance-2">
        <h2 id="statistik" className="sr-only">
          Statistik
        </h2>
        <div className="grid grid-cols-3 gap-space-xs">
          <StatTile label="Divalidasi" value={stats?.validated ?? '…'} hint="Bongkaran" icon={Truck} />
          <StatTile label="Kepatuhan" value={stats?.complianceRate ?? '…'} hint="Q&Q" icon={FlaskConical} tone="success" />
          <StatTile label="Laporan" value={stats?.reportsThisMonth ?? '…'} hint="Bulan ini" icon={FileText} tone="primary" />
        </div>
      </section>

      <section aria-labelledby="akun" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="akun" title="Akun" />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          <MenuRow icon={UserRound} label="Informasi Akun" />
          <MenuRow icon={Bell} label="Notifikasi" />
          <MenuRow icon={CalendarDays} label="Riwayat Aktivitas" />
          <MenuRow icon={Fuel} label="Unit SPBU Saya" />
        </GlassCard>
      </section>

      <section aria-labelledby="lainnya" className="animate-entrance-4 flex flex-col gap-space-sm">
        <SectionHeader id="lainnya" title="Lainnya" />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          <MenuRow icon={CircleHelp} label="Bantuan" />
          <MenuRow icon={LogOut} label="Keluar" danger />
        </GlassCard>
      </section>
    </div>
  )
}

function MenuRow({ icon: Icon, label, danger = false }: { icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      className="flex min-h-14 w-full items-center gap-space-sm rounded-md px-space-sm text-left transition-colors duration-200 hover:bg-white/50 active:scale-[0.99]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          danger ? 'bg-error-container text-error' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className={cn('flex-1 text-body-md font-semibold', danger ? 'text-error' : 'text-on-surface')}>{label}</span>
      {!danger && <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />}
    </button>
  )
}
