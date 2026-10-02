import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Calculator, ChevronRight, ClipboardList, Database, FileText, FlaskConical, LogOut, MapPin, Settings2, ShieldCheck, Truck, Users } from 'lucide-react'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { cn } from '@/lib/utils'

export function Profil() {
  const app = useApp()
  const now = new Date()
  const selesai = app.reports.filter((r) => r.status === 'selesai').length
  const anomali = app.reports.filter((r) => r.status === 'anomali').length
  const bulanIni = app.reports.filter((r) => {
    const d = new Date(`${r.tanggal}T00:00:00`)
    return r.status !== 'draft' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const remote = app.backend.mode === 'supabase'
  const role = !remote ? 'Mode lokal' : app.session.role === 'pengawas' ? 'Pengawas' : 'Petugas'

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col items-center gap-space-sm p-space-lg text-center">
        <span className="relative">
          <span
            aria-hidden="true"
            className="tabular flex size-20 items-center justify-center rounded-full bg-primary-fixed text-headline-lg font-bold text-on-primary-fixed shadow-sm ring-4 ring-white/80"
          >
            {app.initials}
          </span>
          <span aria-hidden="true" className="absolute bottom-1 right-1 size-4 rounded-full bg-primary-container shadow ring-2 ring-white" />
        </span>
        <div className="flex flex-col items-center gap-space-xs">
          <span className="text-headline-lg font-bold text-on-surface">{app.displayName}</span>
          <div className="flex flex-wrap justify-center gap-space-xs">
            <Pill tone="primary">{role}</Pill>
            {remote && (
              <Pill tone="info">
                <ShieldCheck aria-hidden="true" className="text-primary" />
                {app.session.user?.email}
              </Pill>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <MapPin aria-hidden="true" className="size-4 text-primary" />
          {app.settings.namaSpbu}
        </span>
      </GlassCard>

      <section aria-labelledby="statistik" className="animate-entrance-2">
        <h2 id="statistik" className="sr-only">
          Statistik
        </h2>
        <div className="grid grid-cols-3 gap-space-xs">
          <StatTile label="Selesai" value={selesai} hint="Bongkaran" icon={Truck} />
          <StatTile label="Kepatuhan" value={selesai + anomali > 0 ? `${Math.round((selesai / (selesai + anomali)) * 100)}%` : '-'} hint="Q&Q sesuai" icon={FlaskConical} tone="primary" />
          <StatTile label="Laporan" value={bulanIni} hint="Bulan ini" icon={FileText} tone="primary" />
        </div>
      </section>

      <section aria-labelledby="operasional" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="operasional" title="Operasional" />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          <MenuRow to="/plan" icon={ClipboardList} label="Plan Kirim (SO & LO)" />
          <MenuRow to="/kalkulator" icon={Calculator} label="Kalkulator Density & Tangki" />
        </GlassCard>
      </section>

      <section aria-labelledby="akun" className="animate-entrance-4 flex flex-col gap-space-sm">
        <SectionHeader id="akun" title="Akun & SPBU" />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          <MenuRow to="/pengaturan" icon={Settings2} label={app.canManage ? 'Pengaturan SPBU' : 'Info SPBU & Aturan'} />
          {remote && app.canManage && <MenuRow to="/anggota" icon={Users} label="Anggota SPBU" />}
          <MenuRow to="/pengaturan#data-acuan" icon={Database} label="Data Acuan Tabel" />
          {remote && <MenuRow icon={LogOut} label="Keluar" danger onClick={() => void app.signOut()} />}
        </GlassCard>
        {!remote && (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Mode lokal: data hanya tersimpan di perangkat ini. Hubungkan Supabase agar data tersinkron ke semua petugas.
          </GlassCard>
        )}
      </section>
    </div>
  )
}

function MenuRow({ icon: Icon, label, to, onClick, danger = false }: { icon: LucideIcon; label: string; to?: string; onClick?: () => void; danger?: boolean }) {
  const className = 'flex min-h-14 w-full items-center gap-space-sm rounded-md px-space-sm text-left transition-colors duration-200 hover:bg-white/50 active:scale-[0.99]'
  const body = (
    <>
      <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', danger ? 'bg-error-container text-error' : 'bg-primary/10 text-primary')}>
        <Icon className="size-[18px]" />
      </span>
      <span className={cn('flex-1 text-body-md font-semibold', danger ? 'text-error' : 'text-on-surface')}>{label}</span>
      {!danger && <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />}
    </>
  )
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}
