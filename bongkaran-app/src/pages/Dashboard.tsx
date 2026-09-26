import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Beaker,
  Calculator,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  Droplet,
  FileText,
  FlaskConical,
  MapPin,
  Scale,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatBulanTahun, formatTanggalIso, formatTanggalPanjang, greeting, startOfWeek, todayIso } from '@/lib/date'
import { formatLiter, formatSigned } from '@/lib/format'
import { kalenderMinggu, labelQQ, qqOf, ringkasHariIni, statusProduk, type CalendarDay } from '@/lib/ringkasan'
import { STEPS } from '@/lib/sop'
import { cn } from '@/lib/utils'

const DAY_CLASS: Record<CalendarDay['status'], string> = {
  sesuai: 'bg-primary-fixed text-on-primary-fixed',
  catatan: 'bg-error-container text-on-error-container',
  belum: 'inset-field text-on-surface-variant',
}

const DAY_LABEL: Record<CalendarDay['status'], string> = {
  sesuai: 'sesuai',
  catatan: 'ada anomali',
  belum: 'belum ada bongkaran selesai',
}

export function Dashboard() {
  const app = useApp()
  const now = new Date()
  if (!app.loaded) return <Loading />

  const mingguIni = app.reports.filter((r) => r.tanggal >= todayIso(startOfWeek(now)))
  const today = ringkasHariIni(app.reports, now)
  const productStatuses = statusProduk(mingguIni)
  const calendarWeek = kalenderMinggu(mingguIni, now)
  const terbaru = app.reports.slice(0, 5)
  const roleLabel = app.backend.mode === 'local' ? 'Mode lokal' : app.session.role === 'pengawas' ? 'Pengawas' : 'Petugas'

  return (
    <div className="flex flex-col gap-space-md">
      {/* Bongkaran hari ini — angka pertama yang dicari pengawas saat membuka aplikasi. */}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-center gap-space-xs">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary-container" />
          <span className="text-tag uppercase text-primary">
            {greeting(now)}
            {app.session.user ? `, ${app.displayName.split(/[\s@]/)[0]}` : app.settings.namaPetugasDefault ? `, ${app.settings.namaPetugasDefault.split(' ')[0]}` : ''}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-space-sm">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Truck className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-on-surface-variant">Total bongkaran hari ini</span>
            <span className="tabular text-numeric-lg font-bold text-on-surface sm:text-headline-xl">{formatLiter(today.totalLiter)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <Pill tone="info">
            <MapPin aria-hidden="true" className="text-primary" />
            {app.settings.namaSpbu || 'SPBU'}
          </Pill>
          <Pill tone="primary">{roleLabel}</Pill>
          <Pill tone="neutral">{formatTanggalPanjang(now)}</Pill>
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
          <StatTile label="Mobil tangki" value={today.mobilTangki} hint="Datang hari ini" icon={Truck} />
          <StatTile label="Gain / loss" value={formatSigned(today.gainLoss, 0, ' L')} hint="Bongkaran selesai" icon={Scale} tone={today.gainLoss < 0 ? 'error' : 'primary'} />
          <StatTile label="Q&Q sesuai" value={`${today.qqSesuai}/${today.qqTotal}`} hint="Selesai hari ini" icon={FlaskConical} tone="primary" />
          <StatTile
            label="Perlu cek"
            value={today.perluCek.length}
            hint={today.perluCek.length > 0 ? today.perluCek.map((r) => r.nopol).join(', ') : 'Semua aman'}
            icon={Beaker}
            tone={today.perluCek.length > 0 ? 'error' : 'primary'}
          />
        </div>
      </section>

      <nav aria-label="Aksi cepat" className="animate-entrance-3 grid grid-cols-4 gap-space-xs">
        <QuickAction to="/input" icon={ClipboardPlus} label="Input Bongkaran" />
        <QuickAction to="/plan" icon={ClipboardList} label="Plan Kirim" />
        <QuickAction to="/kalkulator" icon={Calculator} label="Kalkulator" />
        <QuickAction to="/laporan" icon={FileText} label="Berita Acara" />
      </nav>

      <div className="grid gap-space-md lg:grid-cols-2">
        <section aria-labelledby="kalender-progress" className="animate-entrance-3 flex flex-col gap-space-sm">
          <SectionHeader id="kalender-progress" title="Kalender Progress" action={<span className="text-body-sm text-on-surface-variant">{formatBulanTahun(now)}</span>} />
          <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
            <ol className="grid grid-cols-7 gap-1">
              {calendarWeek.map((day) => (
                <li key={day.date} className="flex flex-col items-center gap-1.5">
                  <span className={cn('text-tag uppercase text-on-surface-variant', day.isToday && 'text-primary')}>{day.label}</span>
                  <span
                    aria-label={`${day.label} ${day.date}, ${DAY_LABEL[day.status]}${day.isToday ? ', hari ini' : ''}`}
                    className={cn(
                      'tabular flex size-9 items-center justify-center rounded-full text-numeric-sm font-bold',
                      day.isToday ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]' : DAY_CLASS[day.status],
                    )}
                  >
                    {day.date}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-x-space-md gap-y-1 border-t border-outline-variant/40 pt-space-sm">
              <Legend className="bg-primary-fixed" label="Sesuai" />
              <Legend className="bg-error-container ring-1 ring-error/30" label="Ada anomali" />
              <Legend className="inset-field ring-1 ring-outline-variant" label="Belum ada" />
            </div>
          </GlassCard>
        </section>

        <section aria-labelledby="status-qq" className="animate-entrance-4 flex flex-col gap-space-sm">
          <SectionHeader id="status-qq" title="Status Kualitas & Kuantitas" />
          <GlassCard level={2} className="flex flex-col p-space-2xs">
            {productStatuses.map((p) => (
              <div key={p.name} className="flex min-h-14 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed/60 text-primary">
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
        {terbaru.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada bongkaran tercatat.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {terbaru.map((r) => {
              const qq = qqOf(r)
              return (
                <Link key={r.id} to={`/input/${r.id}`}>
                  <GlassCard level={1} className="transition-shadow duration-200 hover:shadow-md">
                    <div className="flex items-center gap-space-sm p-space-sm">
                      <span
                        aria-hidden="true"
                        className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', qq === 'perhatian' ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary')}
                      >
                        <Truck className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-body-md font-semibold text-on-surface">{r.produk || 'Produk belum dipilih'}</span>
                          <QQPill status={qq} label={labelQQ(r, STEPS.length)} />
                        </div>
                        <span className="truncate text-body-sm text-on-surface-variant">
                          <span className="tabular">{r.nopol || 'MT baru'}</span> • {formatTanggalIso(r.tanggal)} {r.jam}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className="tabular text-numeric-md font-bold text-on-surface">{r.volumeDO ? formatLiter(r.volumeDO) : '—'}</span>
                        {r.gainLoss !== null && (
                          <span className={cn('tabular text-numeric-sm', r.gainLoss < 0 ? 'text-error' : 'text-on-surface-variant')}>{formatSigned(r.gainLoss, 0, ' L')}</span>
                        )}
                      </div>
                      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <p className="px-space-xs text-center text-tag text-on-surface-variant">
        {app.settings.namaSpbu}
        {app.settings.alamatSpbu ? ` • ${app.settings.alamatSpbu}` : ''}
        {app.backend.mode === 'local' ? ' — mode lokal, data hanya di perangkat ini' : ''}
      </p>
    </div>
  )
}

const QUICK_ACTION_CLASS =
  'glass-1 rim-light flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg p-space-xs text-center transition-transform duration-200 active:scale-95'

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className={QUICK_ACTION_CLASS}>
      <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="text-body-sm font-semibold leading-tight text-on-surface">{label}</span>
    </Link>
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
