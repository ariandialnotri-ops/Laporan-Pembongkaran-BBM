import { useState, type ReactNode } from 'react'
import { CalendarDays, ChevronRight, CircleCheck, CircleDashed, FilePlus2, FileText, Hourglass } from 'lucide-react'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { currentUser, recentReports, type ReportStatus } from '@/data/mock'
import { cn } from '@/lib/utils'

const STATUS: Record<ReportStatus, { text: string; tone: 'success' | 'error' | 'neutral'; icon: typeof CircleCheck }> = {
  terkirim: { text: 'Terkirim', tone: 'success', icon: CircleCheck },
  menunggu: { text: 'Menunggu TTD', tone: 'error', icon: Hourglass },
  draft: { text: 'Draft', tone: 'neutral', icon: CircleDashed },
}

const ICON_BG: Record<ReportStatus, string> = {
  terkirim: 'bg-tertiary-fixed/60 text-tertiary',
  menunggu: 'bg-error-container text-error',
  draft: 'bg-surface-container text-on-surface-variant',
}

type Filter = 'semua' | ReportStatus

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'terkirim', label: 'Terkirim' },
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'draft', label: 'Draft' },
]

export function Laporan() {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('semua')
  const reports = filter === 'semua' ? recentReports : recentReports.filter((r) => r.status === filter)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">
          {currentUser.spbu} • September 2026
        </span>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          {(['terkirim', 'menunggu', 'draft'] as const).map((s) => (
            <div key={s} className="flex flex-col rounded-md bg-surface-container-low/70 p-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">{STATUS[s].text}</span>
              <span className="tabular mt-0.5 text-numeric-md font-bold text-on-surface">
                {recentReports.filter((r) => r.status === s).length}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-space-xs">
          <Button size="pill" onClick={() => toast('Draf berita acara dibuat')}>
            <FilePlus2 aria-hidden="true" />
            Berita Acara
          </Button>
          <Button variant="glass" size="pill" onClick={() => toast('Draf laporan harian dibuat')}>
            <CalendarDays aria-hidden="true" />
            Laporan Harian
          </Button>
        </div>
      </GlassCard>

      <section aria-labelledby="template-laporan" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="template-laporan" title="Template Laporan" />
        <div className="grid gap-space-xs lg:grid-cols-2">
          <TemplateRow
            icon={<FileText aria-hidden="true" className="size-5" />}
            title="Berita Acara Bongkaran BBM"
            subtitle="Serah terima mobil tangki & hasil Q&Q"
          />
          <TemplateRow
            icon={<CalendarDays aria-hidden="true" className="size-5" />}
            title="Laporan Rutin Harian Q&Q"
            subtitle="Rekap kualitas & kuantitas per shift"
          />
        </div>
      </section>

      <section aria-labelledby="riwayat-laporan" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="riwayat-laporan" title="Riwayat Laporan" />

        <div role="group" aria-label="Saring status laporan" className="flex gap-space-xs overflow-x-auto px-space-2xs pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-full px-4 text-body-sm font-semibold transition-all duration-200 active:scale-95',
                filter === f.id
                  ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.25)]'
                  : 'glass-1 text-on-surface-variant hover:text-on-surface',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {reports.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Tidak ada laporan dengan status ini.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {reports.map((r) => {
              const status = STATUS[r.status]
              const Icon = status.icon
              return (
                <GlassCard key={r.id} level={1} className="transition-shadow duration-200 hover:shadow-md">
                  <div className="flex items-center gap-space-sm p-space-sm">
                    <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', ICON_BG[r.status])}>
                      <FileText className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-body-md font-semibold text-on-surface">{r.title}</span>
                      <span className="truncate text-body-sm text-on-surface-variant">
                        <span className="tabular">{r.date}</span> • {r.spbu}
                      </span>
                    </div>
                    <Pill tone={status.tone}>
                      <Icon aria-hidden="true" />
                      {status.text}
                    </Pill>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function TemplateRow({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      className="glass-2 rim-light flex w-full items-center gap-space-sm rounded-lg p-space-md text-left transition-transform duration-200 active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-md font-bold text-on-surface">{title}</span>
        <span className="text-body-sm text-on-surface-variant">{subtitle}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
    </button>
  )
}
