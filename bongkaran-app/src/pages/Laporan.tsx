import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, CircleCheck, CircleDashed, FileText, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber, formatSigned } from '@/lib/format'
import type { ReportStatus, ReportSummary } from '@/lib/sop'
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

/** Laporan > Berita Acara: satu baris per bongkaran, dibuka untuk tanda tangan atau unduh. */
export function Laporan() {
  const app = useApp()
  const [filter, setFilter] = useState<Filter>('semua')
  const [range, setRange] = useDateRange('month')

  if (!app.loaded) return <Loading />

  const inDate = app.reports.filter((r) => inRange(r.tanggal, range))
  const reports = filter === 'semua' ? inDate : inDate.filter((r) => r.status === filter)
  const count = (s: Filter) => (s === 'semua' ? inDate.length : inDate.filter((r) => r.status === s).length)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="laporan-range" value={range} onChange={setRange} />
        {/* Jumlah per status sekaligus jadi saringan. */}
        <div role="group" aria-label="Saring status" className="grid grid-cols-4 gap-space-xs">
          {(['semua', 'selesai', 'anomali', 'draft'] as const).map((s) => {
            const on = filter === s
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={cn(
                  'flex min-h-14 min-w-0 flex-col items-start justify-center rounded-md px-space-xs text-left transition-colors duration-200 active:scale-[0.98]',
                  on ? 'bg-primary text-on-primary' : 'bg-surface-container-low/70 text-on-surface',
                )}
              >
                <span className={cn('max-w-full truncate text-tag uppercase', on ? 'text-on-primary' : 'text-on-surface-variant')}>{s === 'semua' ? 'Semua' : STATUS[s].text}</span>
                <span className="tabular text-numeric-md font-bold">{count(s)}</span>
              </button>
            )
          })}
        </div>
      </GlassCard>

      {reports.length === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Tidak ada Berita Acara pada rentang tanggal dan status ini.
        </GlassCard>
      ) : (
        <>
          {/* HP: baris kartu. Layar lebar: tabel rekap. */}
          <div className="animate-entrance-2 flex flex-col gap-space-xs md:hidden">
            {reports.map((r) => (
              <BaRow key={r.id} r={r} />
            ))}
          </div>
          <BaTable reports={reports} />
        </>
      )}
    </div>
  )
}

function BaRow({ r }: { r: ReportSummary }) {
  const status = STATUS[r.status]
  const Icon = status.icon
  return (
    <Link to={`/input/${r.id}`}>
      <GlassCard level={1} className="transition-shadow duration-200 hover:shadow-md">
        <div className="flex items-center gap-space-sm p-space-sm">
          <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', ICON_BG[r.status])}>
            <FileText className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-body-md font-semibold text-on-surface">
              {r.produk || '-'}, <span className="tabular">{r.nopol || 'MT'}</span>
            </span>
            <span className="tabular truncate text-body-sm text-on-surface-variant">
              {formatTanggalIso(r.tanggal)} {r.jam}
            </span>
            <span className="tabular truncate text-body-sm text-on-surface-variant">
              {r.shift ? `Shift ${r.shift}, ` : ''}
              <span className="text-on-surface">{r.volumeDO ? `${formatNumber(r.volumeDO)} L` : '-'}</span>
            </span>
          </div>
          <Pill tone={status.tone} className="shrink-0">
            <Icon aria-hidden="true" />
            {status.text}
          </Pill>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
        </div>
      </GlassCard>
    </Link>
  )
}

function BaTable({ reports }: { reports: ReportSummary[] }) {
  const navigate = useNavigate()
  return (
    <GlassCard level={1} className="animate-entrance-2 hidden overflow-hidden md:block">
      <table className="w-full text-left text-body-sm">
        <thead className="border-b border-outline-variant/50 bg-surface-container-low/70">
          <tr className="text-tag uppercase text-on-surface-variant">
            <th scope="col" className="px-space-md py-space-sm font-semibold">BBM</th>
            <th scope="col" className="px-space-sm py-space-sm font-semibold">Nopol</th>
            <th scope="col" className="px-space-sm py-space-sm font-semibold">Tanggal / Jam</th>
            <th scope="col" className="px-space-sm py-space-sm font-semibold">SO / LO</th>
            <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Volume (L)</th>
            <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Gain/Loss (L)</th>
            <th scope="col" className="px-space-sm py-space-sm font-semibold">Status</th>
            <th scope="col" className="px-space-md py-space-sm">
              <span className="sr-only">Buka</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {reports.map((r) => {
            const status = STATUS[r.status]
            const Icon = status.icon
            return (
              <tr key={r.id} onClick={() => navigate(`/input/${r.id}`)} className="cursor-pointer transition-colors hover:bg-primary-fixed/30">
                <td className="px-space-md py-space-sm">
                  <span className="whitespace-nowrap rounded-sm bg-surface-container-lowest px-2 py-1 text-body-sm font-semibold text-on-surface shadow-sm">{r.produk || '-'}</span>
                </td>
                <td className="tabular whitespace-nowrap px-space-sm py-space-sm text-on-surface">{r.nopol || <span className="italic text-on-surface-variant">tanpa nopol</span>}</td>
                <td className="tabular whitespace-nowrap px-space-sm py-space-sm text-on-surface">
                  {formatTanggalIso(r.tanggal)} <span className="text-on-surface-variant">{r.jam}</span>
                  {r.shift ? <span className="text-on-surface-variant">, S{r.shift}</span> : null}
                </td>
                <td className="tabular px-space-sm py-space-sm text-on-surface-variant">
                  {r.noSO || '-'}
                  {r.noLOs.length ? <span className="block">{r.noLOs.join(', ')}</span> : null}
                </td>
                <td className="tabular px-space-sm py-space-sm text-right font-semibold text-on-surface">{r.volumeDO ? formatNumber(r.volumeDO) : '-'}</td>
                <td className={cn('tabular px-space-sm py-space-sm text-right', (r.gainLoss ?? 0) < 0 ? 'font-semibold text-error' : 'text-on-surface')}>
                  {r.gainLoss === null ? '-' : formatSigned(r.gainLoss, 0)}
                </td>
                <td className="px-space-sm py-space-sm">
                  <Pill tone={status.tone}>
                    <Icon aria-hidden="true" />
                    {status.text}
                  </Pill>
                </td>
                <td className="px-space-md py-space-sm text-right">
                  <Link
                    to={`/input/${r.id}`}
                    aria-label={`Buka Berita Acara ${r.nopol || r.produk}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-lowest hover:text-primary"
                  >
                    <ChevronRight aria-hidden="true" className="size-5" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </GlassCard>
  )
}
