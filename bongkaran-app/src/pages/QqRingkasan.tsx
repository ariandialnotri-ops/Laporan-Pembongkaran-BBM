import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, FlaskConical, Ruler, TriangleAlert } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { BEJANA_LIMIT_ML, bejanaStatus, qqRecordId, type QqRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatNumber, formatSigned } from '@/lib/format'
import { kualitasProduk, kuantitasNozzle } from '@/lib/ringkasan'
import { currentShift, shiftLabel } from '@/lib/shift'
import { cn } from '@/lib/utils'

/** Q&Q > Ringkasan: status uji shift ini, lalu hasil kualitas dan kuantitas terbaru. */
export function QqRingkasan() {
  const app = useApp()
  const kualitas = useMemo(() => kualitasProduk(app.reports), [app.reports])
  const kuantitas = useMemo(() => kuantitasNozzle(app.daily, app.settings.nozzles), [app.daily, app.settings.nozzles])

  if (!app.loaded) return <Loading />

  const key = currentShift()
  const uji = app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === qqRecordId(key.tanggal, key.shift)) ?? null
  const lewat = uji ? uji.data.kuantitas.filter((n) => bejanaStatus(n.selisihMl) === 'lewat').length : 0

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-center gap-space-sm p-space-md">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md',
            !uji ? 'bg-surface-container text-on-surface-variant' : lewat ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary',
          )}
        >
          {uji && !lewat ? <CircleCheck className="size-5" /> : uji ? <TriangleAlert className="size-5" /> : <FlaskConical className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">{shiftLabel(key.shift).split(' (')[0]}: {uji ? 'sudah diuji' : 'belum diuji'}</span>
          <span className="text-body-sm text-on-surface-variant">
            {uji ? `Jam ${uji.data.jam || '-'}${lewat ? `, ${lewat} nozzle di bawah ${formatNumber(BEJANA_LIMIT_ML)} ml` : ', semua nozzle dalam batas'}` : 'Uji density dan bejana 20 L sekali tiap shift.'}
          </span>
        </div>
        {!uji && (
          <Link to="/qq/uji" replace className={buttonVariants({ size: 'pill' })}>
            Uji
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </GlassCard>

      <section aria-labelledby="ringkas-kualitas" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="ringkas-kualitas" title="Kualitas" action={<FlaskConical aria-hidden="true" className="size-5 text-on-surface-variant" />} />
        <p className="px-space-xs text-body-sm text-on-surface-variant">Density 15°C dari 3 bongkaran terakhir tiap produk, dibanding D15 dokumen depot.</p>
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 px-space-sm">
          {kualitas.map((k) => (
            <div key={k.produk} className="flex flex-col gap-space-xs py-space-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-md font-semibold text-on-surface">{k.produk}</span>
                <QQPill status={k.status} label={k.status === 'sesuai' ? 'Sesuai' : k.status === 'perhatian' ? 'Ada anomali' : 'Belum ada sampel'} />
              </div>
              {k.samples.length > 0 && (
                <ol className="grid grid-cols-3 gap-space-xs">
                  {k.samples.map((s) => (
                    <li key={s.id} className={cn('flex flex-col rounded-md px-space-xs py-1', s.ok === false ? 'bg-error-container/70' : 'bg-surface-container-low/80')}>
                      <span className="tabular text-numeric-sm font-bold text-on-surface">{formatDensity(s.d15)}</span>
                      <span className={cn('tabular text-body-sm', s.ok === false ? 'font-semibold text-error' : 'text-on-surface-variant')}>
                        {s.selisih !== null ? formatDensitySigned(s.selisih) : '-'}
                      </span>
                      <span className="truncate text-body-sm text-on-surface-variant">{formatTanggalIso(s.tanggal)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </GlassCard>
      </section>

      <section aria-labelledby="ringkas-kuantitas" className="animate-entrance-3 flex flex-col gap-space-xs">
        <SectionHeader id="ringkas-kuantitas" title="Kuantitas" action={<Ruler aria-hidden="true" className="size-5 text-on-surface-variant" />} />
        <p className="px-space-xs text-body-sm text-on-surface-variant">
          Tera bejana 20 L terakhir tiap nozzle. Di bawah {formatNumber(BEJANA_LIMIT_ML)} ml ditandai merah.
        </p>
        {kuantitas.length === 0 ? (
          <GlassCard level={1} className="flex flex-col items-center gap-space-xs p-space-md text-center">
            <span className="text-body-sm text-on-surface-variant">Belum ada nozzle terdaftar.</span>
            <Link to="/pengaturan#nozzle" className={buttonVariants({ variant: 'glass', size: 'pill' })}>
              Atur nozzle di Pengaturan
            </Link>
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 px-space-sm">
            {kuantitas.map((g) => (
              <div key={g.produk} className="flex flex-col gap-space-xs py-space-sm">
                <span className="text-body-md font-semibold text-on-surface">{g.produk}</span>
                <ul className="grid grid-cols-2 gap-space-xs">
                  {g.nozzles.map((n) => (
                    <li key={n.key} className={cn('flex flex-col rounded-md px-space-xs py-1', n.lewat ? 'bg-error-container/70' : 'bg-surface-container-low/80')}>
                      <span className="text-body-sm font-semibold text-on-surface">{n.nozzle}</span>
                      <span className={cn('tabular text-numeric-sm font-bold', n.lewat ? 'text-error' : 'text-on-surface')}>
                        {n.selisihMl === null ? 'Belum diuji' : `${formatSigned(n.selisihMl, 0)} ml`}
                      </span>
                      {n.tanggal && (
                        <span className="truncate text-body-sm text-on-surface-variant">
                          {formatTanggalIso(n.tanggal)}, shift {n.shift}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </GlassCard>
        )}
      </section>
    </div>
  )
}
