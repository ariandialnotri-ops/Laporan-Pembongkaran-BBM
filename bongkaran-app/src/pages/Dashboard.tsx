import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Beaker,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  Droplet,
  FileText,
  FlaskConical,
  MapPin,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { calendarWeek, currentUser, productStatuses, recentUnloadings, todaySummary, type CalendarDay } from '@/data/mock'
import { formatLiter, formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY_CLASS: Record<CalendarDay['status'], string> = {
  sesuai: 'bg-tertiary-container text-on-tertiary',
  catatan: 'bg-error-container text-on-error-container',
  belum: 'inset-field text-on-surface-variant',
}

const DAY_LABEL: Record<CalendarDay['status'], string> = {
  sesuai: 'sesuai',
  catatan: 'ada catatan',
  belum: 'belum input',
}

export function Dashboard() {
  const perhatian = productStatuses.filter((p) => p.status === 'perhatian')

  return (
    <div className="flex flex-col gap-space-md">
      {/* Today's unloading — the one number a supervisor opens this app for. */}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-space-xs">
            <span aria-hidden="true" className="size-2 rounded-full bg-tertiary-container animate-pulse" />
            <span className="text-tag uppercase text-primary">
              {currentUser.greeting}, {currentUser.name}
            </span>
          </div>
          <button
            type="button"
            aria-label="Notifikasi, ada yang belum dibaca"
            className="glass-1 relative flex size-11 items-center justify-center rounded-full text-on-surface transition-transform duration-200 active:scale-95"
          >
            <Bell aria-hidden="true" className="size-5" />
            <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-error ring-2 ring-white" />
          </button>
        </div>

        <div className="flex items-end justify-between gap-space-sm">
          <div className="flex min-w-0 items-center gap-space-sm">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm"
            >
              <Truck className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-tag uppercase text-on-surface-variant">Total bongkaran hari ini</span>
              <span className="tabular text-numeric-lg font-bold text-on-surface sm:text-headline-xl">
                {formatLiter(todaySummary.totalLiter)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <Pill tone="info">
            <MapPin aria-hidden="true" className="text-primary" />
            {currentUser.spbu}
          </Pill>
          <Pill tone="primary">{currentUser.role}</Pill>
          <Pill tone="neutral">{currentUser.today}</Pill>
        </div>

        <Link to="/input" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
          Input bongkaran baru
          <ArrowRight aria-hidden="true" />
        </Link>
      </GlassCard>

      <section aria-labelledby="angka-hari-ini" className="animate-entrance-2">
        <h2 id="angka-hari-ini" className="sr-only">
          Angka hari ini
        </h2>
        <div className="grid grid-cols-2 gap-space-xs lg:grid-cols-4">
          <StatTile label="Mobil tangki" value={todaySummary.mobilTangki} hint="Selesai bongkar" icon={Truck} />
          <StatTile label="SPBU" value={todaySummary.spbu} hint="Menerima BBM" icon={MapPin} tone="primary" />
          <StatTile
            label="Q&Q sesuai"
            value={`${todaySummary.qqSesuai}/${todaySummary.qqTotal}`}
            hint="Produk hari ini"
            icon={FlaskConical}
            tone="success"
          />
          <StatTile
            label="Perlu cek"
            value={perhatian.length}
            hint={perhatian.length > 0 ? perhatian.map((p) => p.name).join(', ') : 'Semua aman'}
            icon={Beaker}
            tone={perhatian.length > 0 ? 'error' : 'success'}
          />
        </div>
      </section>

      <nav aria-label="Aksi cepat" className="animate-entrance-3 grid grid-cols-4 gap-space-xs">
        <QuickAction to="/input" icon={ClipboardPlus} label="Input Bongkaran" />
        <QuickAction to="/input?tab=quality" icon={Beaker} label="Input Q&Q" />
        <QuickAction href="#kalender-progress" icon={CalendarDays} label="Kalender" />
        <QuickAction to="/laporan" icon={FileText} label="Berita Acara" />
      </nav>

      <div className="grid gap-space-md lg:grid-cols-2">
        <section aria-labelledby="kalender-progress" className="animate-entrance-3 flex flex-col gap-space-sm">
          <SectionHeader
            id="kalender-progress"
            title="Kalender Progress"
            action={<span className="text-body-sm text-on-surface-variant">September 2026</span>}
          />
          <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
            <ol className="grid grid-cols-7 gap-1">
              {calendarWeek.map((day) => (
                <li key={day.date} className="flex flex-col items-center gap-1.5">
                  <span className={cn('text-tag uppercase text-on-surface-variant', day.isToday && 'text-primary')}>
                    {day.label}
                  </span>
                  <span
                    aria-label={`${day.label} ${day.date}, ${DAY_LABEL[day.status]}${day.isToday ? ', hari ini' : ''}`}
                    className={cn(
                      'tabular flex size-9 items-center justify-center rounded-full text-numeric-sm font-bold',
                      day.isToday
                        ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]'
                        : DAY_CLASS[day.status],
                    )}
                  >
                    {day.date}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-x-space-md gap-y-1 border-t border-outline-variant/40 pt-space-sm">
              <Legend className="bg-tertiary-container" label="Sesuai" />
              <Legend className="bg-error-container ring-1 ring-error/30" label="Ada catatan" />
              <Legend className="inset-field ring-1 ring-outline-variant" label="Belum input" />
            </div>
          </GlassCard>
        </section>

        <section aria-labelledby="status-qq" className="animate-entrance-4 flex flex-col gap-space-sm">
          <SectionHeader id="status-qq" title="Status Kualitas & Kuantitas" />
          <GlassCard level={2} className="flex flex-col p-space-2xs">
            {productStatuses.map((p) => (
              <div key={p.id} className="flex min-h-14 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-fixed/50 text-secondary"
                >
                  <Droplet className="size-4" />
                </span>
                <span className="flex-1 truncate text-body-md font-semibold text-on-surface">{p.name}</span>
                <QQPill status={p.status} label={p.note} />
              </div>
            ))}
          </GlassCard>
        </section>
      </div>

      <section aria-labelledby="riwayat-bongkaran" className="animate-entrance-5 flex flex-col gap-space-sm">
        <SectionHeader
          id="riwayat-bongkaran"
          title="Riwayat Bongkaran"
          action={
            <Link to="/laporan" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Semua
              <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <div className="flex flex-col gap-space-xs">
          {recentUnloadings.map((entry) => {
            const selisih = entry.volumeReal - entry.volumeDo
            return (
              <GlassCard key={entry.id} level={1} className="transition-shadow duration-200 hover:shadow-md">
                <div className="flex items-center gap-space-sm p-space-sm">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-md',
                      entry.qqStatus === 'perhatian' ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary',
                    )}
                  >
                    <Truck className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-body-md font-semibold text-on-surface">{entry.product}</span>
                      <QQPill status={entry.qqStatus} label={entry.qqNote} />
                    </div>
                    <span className="truncate text-body-sm text-on-surface-variant">
                      <span className="tabular">{entry.plate}</span> • {entry.time}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="tabular text-numeric-md font-bold text-on-surface">{formatLiter(entry.volumeReal)}</span>
                    <span
                      className={cn(
                        'tabular text-numeric-sm',
                        selisih < 0 ? 'text-error' : 'text-on-surface-variant',
                      )}
                    >
                      {formatSigned(selisih, 0, ' L')}
                    </span>
                  </div>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                </div>
              </GlassCard>
            )
          })}
        </div>
      </section>

      <p className="px-space-xs text-center text-tag text-on-surface-variant">
        {currentUser.spbu} • {currentUser.spbuAddress} — data contoh, belum terhubung database
      </p>
    </div>
  )
}

const QUICK_ACTION_CLASS =
  'glass-1 rim-light flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg p-space-xs text-center transition-transform duration-200 active:scale-95'

/** `to` routes through the router; `href` is an in-page anchor. */
function QuickAction({ to, href, icon: Icon, label }: { to?: string; href?: string; icon: LucideIcon; label: string }) {
  const body = (
    <>
      <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="text-body-sm font-semibold leading-tight text-on-surface">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className={QUICK_ACTION_CLASS}>
      {body}
    </Link>
  ) : (
    <a href={href} className={QUICK_ACTION_CLASS}>
      {body}
    </a>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-2.5 rounded-full', className)} />
      <span className="text-body-sm text-on-surface-variant">{label}</span>
    </span>
  )
}
