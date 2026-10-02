import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, CircleDashed, FileSpreadsheet, FileText, LoaderCircle, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { StokRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import { persediaanRows } from '@/lib/report/persediaan'
import { PRODUK_OPTIONS, type ReportStatus } from '@/lib/sop'
import { tankForProduk } from '@/lib/tank'
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
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('semua')
  const [range, setRange] = useDateRange('month')
  const [produk, setProduk] = useState(PRODUK_OPTIONS[0])
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)

  const stok = useMemo(() => app.daily.filter((d): d is StokRecord => d.kind === 'stok'), [app.daily])
  const from = range.from || '0000-01-01'
  const to = range.to || todayIso()
  const rows = useMemo(() => persediaanRows(produk, from, to, stok, app.reports), [produk, from, to, stok, app.reports])

  if (!app.loaded) return <Loading />

  const inDate = app.reports.filter((r) => inRange(r.tanggal, range))
  const reports = filter === 'semua' ? inDate : inDate.filter((r) => r.status === filter)

  const unduh = async (kind: 'xlsx' | 'pdf') => {
    if (!rows.length) return toast('Belum ada data stok shift atau bongkaran untuk produk & tanggal ini', TriangleAlert)
    setBusy(kind)
    try {
      const ex = await import('@/lib/report/export')
      const tank = tankForProduk(produk)
      const data = { rows, header: { noSpbu: app.settings.kodeSpbu, produk, tangki: tank ? String(tank.tankNo) : '' } }
      const name = `Catatan_Persediaan_${produk.replace(/\s+/g, '')}_${from}_${to}`
      if (kind === 'xlsx') await ex.exportPersediaanXlsx(data, `${name}.xlsx`)
      else await ex.exportPersediaanPdf(data, `${name}.pdf`)
    } catch (e) {
      toast(`Gagal membuat laporan: ${e instanceof Error ? e.message : String(e)}`, TriangleAlert)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <DateFilter id="laporan-range" value={range} onChange={setRange} />
        <div className="grid grid-cols-3 gap-space-xs text-center">
          {(['selesai', 'anomali', 'draft'] as const).map((s) => (
            <div key={s} className="flex flex-col rounded-md bg-surface-container-low/70 p-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">{STATUS[s].text}</span>
              <span className="tabular mt-0.5 text-numeric-md font-bold text-on-surface">{inDate.filter((r) => r.status === s).length}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <div className="flex flex-col">
          <h2 className="text-headline-md font-bold text-on-surface">Catatan Persediaan BBM</h2>
          <span className="text-body-sm text-on-surface-variant">Per produk & tangki, satu baris per shift, mengikuti rentang tanggal di atas. Format sama dengan template Excel.</span>
        </div>
        <Field label="Produk" htmlFor="persediaan-produk">
          <Select value={produk} onValueChange={setProduk}>
            <SelectTrigger id="persediaan-produk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUK_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <span className="tabular text-body-sm text-on-surface-variant">
          {rows.length} baris shift{rows.length > 15 ? `, ${Math.ceil(rows.length / 15)} lembar` : ''}
        </span>
        <div className="grid grid-cols-2 gap-space-xs">
          <Button size="pill" disabled={busy !== null} onClick={() => unduh('xlsx')}>
            {busy === 'xlsx' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
            Excel
          </Button>
          <Button variant="glass" size="pill" disabled={busy !== null} onClick={() => unduh('pdf')}>
            {busy === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}
            PDF
          </Button>
        </div>
      </GlassCard>

      <section aria-labelledby="riwayat-laporan" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="riwayat-laporan" title="Berita Acara Pembongkaran" />

        <div role="group" aria-label="Saring status laporan" className="flex gap-space-xs overflow-x-auto px-space-2xs pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-full px-4 text-body-sm font-semibold transition-colors duration-200 active:scale-95',
                filter === f.id ? 'bg-primary text-on-primary' : 'glass-1 text-on-surface-variant hover:text-on-surface',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {reports.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Tidak ada Berita Acara pada rentang tanggal dan status ini.
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
                          {r.produk || '-'}, <span className="tabular">{r.nopol || 'MT'}</span>
                        </span>
                        <span className="truncate text-body-sm text-on-surface-variant">
                          <span className="tabular">{formatTanggalIso(r.tanggal)}</span>, {r.shift ? `shift ${r.shift}` : 'shift -'}, SO {r.noSO || '-'}
                          {r.volumeDO ? `, ${formatLiter(r.volumeDO)}` : ''}
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
