import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, CircleDashed, FileText, MessageCircle, TriangleAlert } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatBulanTahun, formatTanggalIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import type { ReportStatus } from '@/lib/sop'
import { cn } from '@/lib/utils'

const STATUS: Record<ReportStatus, { text: string; tone: 'primary' | 'error' | 'neutral'; icon: typeof CircleCheck }> = {
  selesai: { text: 'Selesai', tone: 'primary', icon: CircleCheck },
  anomali: { text: 'Anomali', tone: 'error', icon: TriangleAlert },
  draft: { text: 'Draft', tone: 'neutral', icon: CircleDashed },
}

const ICON_BG: Record<ReportStatus, string> = {
  selesai: 'bg-primary-fixed text-primary',
  anomali: 'bg-error-container text-error',
  draft: 'bg-surface-container text-on-surface-variant',
}

type Filter = 'semua' | ReportStatus

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'anomali', label: 'Anomali' },
  { id: 'draft', label: 'Draft' },
]

export function Laporan() {
  const app = useApp()
  const [filter, setFilter] = useState<Filter>('semua')
  const now = new Date()
  if (!app.loaded) return <Loading />

  const bulanIni = app.reports.filter((r) => {
    const d = new Date(`${r.tanggal}T00:00:00`)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const reports = filter === 'semua' ? app.reports : app.reports.filter((r) => r.status === filter)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">
          {app.settings.namaSpbu || 'SPBU'} • {formatBulanTahun(now)}
        </span>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          {(['selesai', 'anomali', 'draft'] as const).map((s) => (
            <div key={s} className="flex flex-col rounded-md bg-surface-container-low/70 p-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">{STATUS[s].text}</span>
              <span className="tabular mt-0.5 text-numeric-md font-bold text-on-surface">{bulanIni.filter((r) => r.status === s).length}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <section aria-labelledby="template-laporan" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="template-laporan" title="Template Laporan" />
        <div className="grid gap-space-xs lg:grid-cols-2">
          <TemplateRow
            icon={<FileText aria-hidden="true" className="size-5" />}
            title="Berita Acara Pembongkaran (Q&Q)"
            subtitle="PDF & JPG dari bongkaran yang sudah selesai"
            onClick={() => setFilter('selesai')}
          />
          <TemplateRow
            icon={<MessageCircle aria-hidden="true" className="size-5" />}
            title="Laporan Grup WhatsApp SPBU"
            subtitle="Teks siap kirim di layar Finish tiap bongkaran"
            onClick={() => setFilter('selesai')}
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
                filter === f.id ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.25)]' : 'glass-1 text-on-surface-variant hover:text-on-surface',
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
                <Link key={r.id} to={`/input/${r.id}`}>
                  <GlassCard level={1} className="transition-shadow duration-200 hover:shadow-md">
                    <div className="flex items-center gap-space-sm p-space-sm">
                      <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', ICON_BG[r.status])}>
                        <FileText className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-body-md font-semibold text-on-surface">
                          BA Bongkaran · {r.produk || '-'} · <span className="tabular">{r.nopol || 'MT'}</span>
                        </span>
                        <span className="truncate text-body-sm text-on-surface-variant">
                          <span className="tabular">{formatTanggalIso(r.tanggal)}</span> • SO {r.noSO || '-'}
                          {r.volumeDO ? ` • ${formatLiter(r.volumeDO)}` : ''}
                        </span>
                      </div>
                      <Pill tone={status.tone}>
                        <Icon aria-hidden="true" />
                        {status.text}
                      </Pill>
                      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function TemplateRow({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
