import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Beaker,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FlaskConical,
  Fuel,
  Ruler,
  Scale,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { useStokShift } from '@/components/bongkaran/stok-gate'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { bejanaStatus, qqD15, qqRecordId, type QqRecord } from '@/lib/daily'
import { addDays, formatBulanTahun, formatTanggalIso, formatTanggalPanjang, greeting, startOfWeek, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { loStatus } from '@/lib/plan'
import { detailTanggal, kalenderMinggu, kuantitasNozzle, labelQQ, qqOf, ringkasHariIni, type CalendarDay } from '@/lib/ringkasan'
import { shiftLabel } from '@/lib/shift'
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
  belum: 'belum ada data',
}

type Tugas = {
  key: string
  to: string
  icon: LucideIcon
  title: string
  detail: string
  /** wajib: kewajiban shift; info: perlu diketahui; selesai: sudah beres. */
  tone: 'wajib' | 'info' | 'selesai'
}

/**
 * HOME menjawab satu pertanyaan: apa yang harus dikerjakan sekarang.
 * Detail per bagian ada di menu dock masing-masing.
 */
export function Dashboard() {
  const app = useApp()
  const now = new Date()
  const stok = useStokShift()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [hari, setHari] = useState<string | null>(null)
  const kuantitas = useMemo(() => kuantitasNozzle(app.daily, app.settings.nozzles), [app.daily, app.settings.nozzles])

  if (!app.loaded) return <Loading />

  const today = ringkasHariIni(app.reports, now)
  const calendarWeek = kalenderMinggu(app.reports, weekAnchor, app.daily, now)
  const thisWeek = todayIso(startOfWeek(weekAnchor)) === todayIso(startOfWeek(now))
  const nama = app.session.user ? app.displayName.split(/[\s@]/)[0] : app.settings.namaPetugasDefault.split(' ')[0]
  const shiftNama = shiftLabel(stok.key.shift).split(' (')[0]

  // Daftar kerja: kewajiban shift dulu, lalu hal yang perlu ditindaklanjuti.
  const uji = app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === qqRecordId(stok.key.tanggal, stok.key.shift))
  const drafts = app.reports.filter((r) => r.status === 'draft')
  const los = app.plans.flatMap((p) => p.los.map((lo) => loStatus(lo, app.usedLoIds)))
  const lewat = kuantitas.flatMap((g) => g.nozzles).filter((n) => n.lewat)
  const tugas: Tugas[] = [
    stok.missing
      ? { key: 'stok', to: '/stok', icon: Fuel, title: `Isi stok awal ${shiftNama}`, detail: 'Wajib sebelum bongkar dan uji Q&Q.', tone: 'wajib' }
      : { key: 'stok', to: '/stok', icon: Fuel, title: `Stok awal ${shiftNama} terisi`, detail: 'Pengeluaran dispenser diisi di akhir shift.', tone: 'selesai' },
    uji
      ? { key: 'qq', to: '/qq', icon: FlaskConical, title: `Uji Q&Q ${shiftNama} selesai`, detail: `Diuji jam ${uji.data.jam || '-'}.`, tone: 'selesai' }
      : { key: 'qq', to: '/qq/uji', icon: FlaskConical, title: `Uji Q&Q ${shiftNama}`, detail: 'Density, suhu, dan bejana 20 L.', tone: 'wajib' },
  ]
  if (drafts.length)
    tugas.push({
      key: 'draft',
      to: drafts.length === 1 ? `/input/${drafts[0].id}` : '/input',
      icon: Truck,
      title: `Lanjutkan ${drafts.length} bongkaran`,
      detail: drafts.map((r) => r.nopol || r.produk || 'MT baru').join(', '),
      tone: 'wajib',
    })
  const kirim = los.filter((s) => s === 'delivery').length
  if (kirim) tugas.push({ key: 'kirim', to: '/plan', icon: Truck, title: `${kirim} LO sedang dikirim`, detail: 'Siapkan tangki dan petugas bongkar.', tone: 'info' })
  const proses = los.filter((s) => s === 'proses').length
  if (proses) tugas.push({ key: 'proses', to: '/plan', icon: ClipboardList, title: `${proses} LO belum terbit`, detail: 'Isi nomor SO dan LO di Plan saat terbit.', tone: 'info' })
  if (lewat.length)
    tugas.push({ key: 'nozzle', to: '/qq', icon: Ruler, title: `${lewat.length} nozzle di bawah batas tera`, detail: lewat.map((n) => n.nozzle).join(', '), tone: 'wajib' })
  if (today.perluCek.length)
    tugas.push({ key: 'anomali', to: '/laporan', icon: TriangleAlert, title: `${today.perluCek.length} bongkaran perlu dicek`, detail: today.perluCek.map((r) => r.nopol).join(', '), tone: 'wajib' })
  const urut = [...tugas.filter((t) => t.tone !== 'selesai'), ...tugas.filter((t) => t.tone === 'selesai')]
  const sisa = tugas.filter((t) => t.tone === 'wajib').length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">
              {greeting(now)}
              {nama ? `, ${nama}` : ''}
            </span>
            <span className="text-body-sm text-on-surface-variant">{formatTanggalPanjang(now)}</span>
          </div>
          <span className="flex shrink-0 flex-col items-end">
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-body-sm font-semibold text-on-primary-fixed">{shiftNama}</span>
            <span className="tabular mt-1 text-body-sm text-on-surface-variant">{shiftLabel(stok.key.shift).match(/\((.*)\)/)?.[1]}</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-tag uppercase text-on-surface-variant">Diterima hari ini</span>
          <span className="tabular text-numeric-lg font-bold text-on-surface sm:text-headline-xl">{formatLiter(today.totalLiter)}</span>
        </div>
        {app.backend.mode === 'local' && <span className="text-body-sm text-on-surface-variant">Mode lokal: data hanya tersimpan di perangkat ini.</span>}
        <Link to="/input" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
          <Truck aria-hidden="true" />
          Bongkar mobil tangki
          <ArrowRight aria-hidden="true" />
        </Link>
      </GlassCard>

      <section aria-labelledby="perlu-dikerjakan" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader
          id="perlu-dikerjakan"
          title="Perlu dikerjakan"
          action={<span className="tabular text-body-sm text-on-surface-variant">{sisa ? `${sisa} belum` : 'Semua beres'}</span>}
        />
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40">
          {urut.map((t) => (
            <TugasRow key={t.key} t={t} />
          ))}
        </GlassCard>
      </section>

      <section aria-labelledby="angka-hari-ini" className="animate-entrance-3 flex flex-col gap-space-xs">
        <SectionHeader id="angka-hari-ini" title="Hari ini" />
        <div className="grid grid-cols-2 gap-space-xs lg:grid-cols-4">
          <StatTile label="Mobil tangki" value={today.mobilTangki} hint="Datang hari ini" icon={Truck} />
          <StatTile label="Gain / loss" value={formatSigned(today.gainLoss, 0, ' L')} hint="Bongkaran selesai" icon={Scale} tone={today.gainLoss < 0 ? 'error' : 'primary'} />
          <StatTile label="Q&Q sesuai" value={`${today.qqSesuai}/${today.qqTotal}`} hint="Bongkaran selesai" icon={FlaskConical} tone="primary" />
          <StatTile label="Perlu cek" value={today.perluCek.length} hint={today.perluCek.length ? 'Lihat di Laporan' : 'Semua aman'} icon={Beaker} tone={today.perluCek.length > 0 ? 'error' : 'primary'} />
        </div>
      </section>

      <section aria-labelledby="kalender" className="animate-entrance-4 flex flex-col gap-space-xs">
        <SectionHeader
          id="kalender"
          title="Kalender"
          action={
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Minggu sebelumnya" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} className="flex size-11 items-center justify-center rounded-full text-on-surface-variant active:scale-95">
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
              <span className="whitespace-nowrap text-body-sm text-on-surface-variant">{formatBulanTahun(weekAnchor)}</span>
              <button
                type="button"
                aria-label="Minggu berikutnya"
                disabled={thisWeek}
                onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
                className="flex size-11 items-center justify-center rounded-full text-on-surface-variant active:scale-95 disabled:opacity-30"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </div>
          }
        />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <ol className="grid grid-cols-7 gap-1">
            {calendarWeek.map((day) => (
              <li key={day.iso} className="flex flex-col items-center gap-1.5">
                <span className={cn('text-tag uppercase text-on-surface-variant', day.isToday && 'text-primary')}>{day.label}</span>
                <button
                  type="button"
                  onClick={() => setHari(day.iso)}
                  aria-label={`${formatTanggalIso(day.iso)}, ${DAY_LABEL[day.status]}${day.isToday ? ', hari ini' : ''}. Lihat detail`}
                  className={cn(
                    'tabular touch-44 flex size-10 items-center justify-center rounded-full text-numeric-sm font-bold transition-transform active:scale-90',
                    day.isToday ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]' : DAY_CLASS[day.status],
                  )}
                >
                  {day.date}
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-x-space-md gap-y-1 border-t border-outline-variant/40 pt-space-sm">
            <Legend className="bg-primary-fixed" label="Sesuai" />
            <Legend className="bg-error-container ring-1 ring-error/30" label="Ada anomali" />
            <Legend className="inset-field ring-1 ring-outline-variant" label="Belum ada" />
            <span className="text-body-sm text-on-surface-variant">Ketuk tanggal untuk detail.</span>
          </div>
        </GlassCard>
      </section>

      <DetailHari iso={hari} onClose={() => setHari(null)} />
    </div>
  )
}

const TUGAS_ICON: Record<Tugas['tone'], string> = {
  wajib: 'bg-error-container text-error',
  info: 'bg-primary-fixed text-primary',
  selesai: 'bg-surface-container text-on-surface-variant',
}

function TugasRow({ t }: { t: Tugas }) {
  const Icon = t.tone === 'selesai' ? CircleCheck : t.icon
  return (
    <Link to={t.to} className="flex min-h-16 items-center gap-space-sm px-space-sm py-space-xs transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-surface-container-lowest/60">
      <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', TUGAS_ICON[t.tone])}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-body-md font-semibold', t.tone === 'selesai' ? 'text-on-surface-variant' : 'text-on-surface')}>{t.title}</span>
        <span className="truncate text-body-sm text-on-surface-variant">{t.detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
    </Link>
  )
}

/** Detail satu tanggal: penerimaan, kualitas, kuantitas, dan stok shift. */
function DetailHari({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const app = useApp()
  const d = iso ? detailTanggal(iso, app.reports, app.daily) : null
  const diterima = d ? d.bongkaran.filter((r) => r.status !== 'draft').reduce((n, r) => n + (r.volumeDO ?? 0), 0) : 0
  return (
    <Sheet open={!!iso} onOpenChange={(o) => !o && onClose()} title={iso ? formatTanggalIso(iso) : ''} description="Penerimaan, kualitas, dan kuantitas pada tanggal ini.">
      {d && (
        <>
          <section aria-label="Penerimaan" className="flex flex-col gap-space-xs">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-body-md font-bold text-on-surface">Penerimaan</h3>
              <span className="tabular text-body-sm text-on-surface-variant">{formatLiter(diterima)} diterima</span>
            </div>
            {d.bongkaran.length === 0 ? (
              <span className="text-body-sm text-on-surface-variant">Tidak ada bongkaran.</span>
            ) : (
              d.bongkaran.map((r) => (
                <Link key={r.id} to={`/input/${r.id}`} onClick={onClose} className="inset-field flex min-h-12 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-sm font-semibold text-on-surface">
                      {r.produk || '-'}, {r.nopol || 'MT'}, {r.jam}
                    </span>
                    <span className="tabular text-body-sm text-on-surface-variant">
                      DO {r.volumeDO ? formatLiter(r.volumeDO) : '-'}, gain/loss {r.gainLoss !== null ? formatSigned(r.gainLoss, 0, ' L') : '-'}
                    </span>
                  </div>
                  <QQPill status={qqOf(r)} label={labelQQ(r, STEPS.length)} />
                </Link>
              ))
            )}
          </section>

          <section aria-label="Kualitas" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Kualitas</h3>
            {d.bongkaran.filter((r) => r.d15 !== null).length === 0 && d.qq.every((q) => !q.data.kualitas.length) && (
              <span className="text-body-sm text-on-surface-variant">Belum ada uji density.</span>
            )}
            {d.bongkaran
              .filter((r) => r.d15 !== null)
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="text-on-surface">
                    Bongkar {r.produk} {r.nopol}
                  </span>
                  <span className={cn('tabular font-semibold', r.densityOk === false ? 'text-error' : 'text-on-surface')}>
                    D15 {formatDensity(r.d15)}
                    {r.d15Depot !== null ? ` (${formatDensitySigned(Math.round((r.d15! - r.d15Depot) * 10000) / 10000)})` : ''}
                  </span>
                </div>
              ))}
            {d.qq.flatMap((q) =>
              q.data.kualitas.map((k) => {
                const v = qqD15(k).d15
                return (
                  <div key={k.id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="text-on-surface">
                      Uji harian shift {q.shift}, {k.produk}
                    </span>
                    <span className="tabular font-semibold text-on-surface">D15 {v ? formatDensity(v.value) : '-'}</span>
                  </div>
                )
              }),
            )}
          </section>

          <section aria-label="Kuantitas" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Kuantitas</h3>
            {d.qq.every((q) => !q.data.kuantitas.length) && d.stok.length === 0 && <span className="text-body-sm text-on-surface-variant">Belum ada uji bejana atau stok shift.</span>}
            {d.qq.flatMap((q) =>
              q.data.kuantitas.map((n) => {
                const lewat = bejanaStatus(n.selisihMl) === 'lewat'
                return (
                  <div key={n.id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="text-on-surface">
                      Shift {q.shift}, {n.nozzle} ({n.produk})
                    </span>
                    <span className={cn('tabular font-semibold', lewat ? 'text-error' : 'text-on-surface')}>{n.selisihMl || '-'} ml</span>
                  </div>
                )
              }),
            )}
            {d.stok.map((s) => (
              <div key={s.id} className="flex flex-col gap-1 text-body-sm">
                <span className="text-on-surface">
                  Stok awal shift {s.shift}, {s.data.petugas || '-'}
                </span>
                <ul className="tabular grid grid-cols-2 gap-x-space-sm text-on-surface-variant">
                  {Object.entries(s.data.items).map(([produk, it]) => (
                    <li key={produk} className="flex justify-between gap-2">
                      <span className="truncate">{produk}</span>
                      <span className="text-on-surface">{formatNumber(parseAngka(it.volume) ?? 0)} L</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </Sheet>
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
