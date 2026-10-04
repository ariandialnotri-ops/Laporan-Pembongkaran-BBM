import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, CircleDashed, CirclePlus, Cylinder, Eye, Fuel, Info, ShieldCheck, TriangleAlert } from 'lucide-react'
import { KalengDetail } from '@/components/bongkaran/kaleng-detail'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatNumber } from '@/lib/format'
import { produkMeta } from '@/lib/produk'
import { kalengSample, type Kaleng } from '@/lib/ringkasan'
import { tankForProduk, tankName } from '@/lib/tank'
import { cn } from '@/lib/utils'

const STATUS = {
  sesuai: { label: 'Sesuai', tone: 'success', icon: CircleCheck },
  perhatian: { label: 'Ada anomali', tone: 'error', icon: TriangleAlert },
  belum: { label: 'Belum ada sampel', tone: 'neutral', icon: CircleDashed },
} as const

const jamDari = (ms: number) => new Date(ms).toTimeString().slice(0, 5)

/**
 * Kaleng Sample: 3 kaleng tersimpan per produk (kiri terbaru, kanan terlama),
 * dibanding D15 dokumen depot. Ketuk kaleng untuk detail uji.
 */
export function KalengSample() {
  const app = useApp()
  const data = useMemo(() => kalengSample(app.reports, app.plans, app.usedLoIds, (p) => produkMeta(p).kode), [app.reports, app.plans, app.usedLoIds])
  // Produk tanpa sampel tertutup; yang lain terbuka.
  const [buka, setBuka] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<{ k: Kaleng; slot: number } | null>(null)

  const sesuai = data.filter((d) => d.status === 'sesuai').length
  const anomali = data.filter((d) => d.status === 'perhatian').length
  const belum = data.filter((d) => d.status === 'belum').length
  const terbaru = Math.max(0, ...data.flatMap((d) => d.cans.map((c) => c.updatedAt)))
  const tol = formatDensity(app.rules.densityTolerance)

  return (
    <section aria-labelledby="kaleng-sample" className="flex flex-col gap-space-sm">
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Cylinder className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id="kaleng-sample" className="text-headline-md font-bold text-on-surface">
                Kaleng Sample
              </h2>
              <Pill tone="primary">SOP Q&Q</Pill>
            </div>
            <span className="text-body-sm text-on-surface-variant">Monitoring mutu BBM {app.settings.namaSpbu || 'SPBU'}</span>
          </div>
        </div>
        <p className="flex gap-space-xs text-body-sm text-on-surface-variant">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Density 15°C dari 3 bongkaran terakhir tiap produk, dibanding D15 dokumen depot. Toleransi selisih <b className="tabular text-on-surface">±{tol}</b>.
          </span>
        </p>
        <dl className="grid grid-cols-2 gap-space-xs border-t border-outline-variant/40 pt-space-sm lg:grid-cols-4">
          <Ringkas label="Produk" value={`${data.length} produk`} />
          <Ringkas label="Sampel sesuai" value={`${sesuai} produk`} tone="ok" />
          <Ringkas label={anomali ? 'Ada anomali' : 'Belum ada sampel'} value={`${anomali || belum} produk`} tone={anomali ? 'bad' : 'wait'} />
          <Ringkas label="Pembaruan" value={terbaru ? `${new Date(terbaru).toDateString() === new Date().toDateString() ? 'Hari ini' : formatTanggalIso(todayIso(new Date(terbaru)))}, ${jamDari(terbaru)}` : '-'} />
        </dl>
      </GlassCard>

      {data.map((d) => {
        const meta = produkMeta(d.produk)
        const tank = tankForProduk(d.produk)
        const open = buka[d.produk] ?? d.cans.length > 0
        const st = STATUS[d.status]
        const StIcon = st.icon
        const latest = d.cans[0]
        const panelId = `kaleng-${meta.kode}`
        return (
          <GlassCard key={d.produk} level={2} className="overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setBuka({ ...buka, [d.produk]: !open })}
              className="flex w-full flex-col gap-space-sm p-space-md text-left transition-colors hover:bg-surface-container-lowest/40 md:flex-row md:items-center"
            >
              <span className="flex min-w-0 flex-1 items-center gap-space-sm">
                <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', meta.tile)}>
                  <Fuel className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-body-lg font-bold text-on-surface">{d.produk}</span>
                    {meta.spek && <span className={cn('tabular rounded-sm border px-1.5 text-body-sm', meta.chip)}>{meta.spek}</span>}
                  </span>
                  <span className="truncate text-body-sm text-on-surface-variant">{tank ? `${tankName(tank.tankNo)}, kapasitas ${formatNumber(tank.capacity)} L` : 'Tangki belum diatur'}</span>
                </span>
              </span>
              <span className="flex items-center justify-between gap-space-sm md:justify-end">
                {latest ? (
                  <span className="flex gap-space-md">
                    <span className="flex flex-col md:items-end">
                      <span className="text-tag uppercase text-on-surface-variant">D15 terkini</span>
                      <span className="tabular text-body-sm font-bold text-on-surface">
                        {formatDensity(latest.d15)} <span className={cn('font-semibold', latest.densityOk === false ? 'text-error' : 'text-primary')}>({latest.selisih !== null ? formatDensitySigned(latest.selisih) : '-'})</span>
                      </span>
                    </span>
                    <span className="flex flex-col md:items-end">
                      <span className="text-tag uppercase text-on-surface-variant">Bongkar terakhir</span>
                      <span className="tabular text-body-sm text-on-surface">{formatTanggalIso(latest.tanggal)}</span>
                    </span>
                  </span>
                ) : (
                  <span className="text-body-sm text-on-surface-variant">Belum ada kaleng tersimpan</span>
                )}
                <span className="flex items-center gap-space-xs">
                  <Pill tone={st.tone}>
                    <StIcon aria-hidden="true" />
                    {st.label}
                  </Pill>
                  <ChevronDown aria-hidden="true" className={cn('size-5 text-on-surface-variant transition-transform duration-200', open && 'rotate-180')} />
                </span>
              </span>
            </button>

            {open && (
              <div id={panelId} className="flex flex-col gap-space-sm border-t border-outline-variant/40 bg-surface-container-lowest/30 p-space-md">
                {d.cans.length === 0 ? (
                  <div className="flex flex-col items-center gap-space-xs rounded-lg border border-dashed border-outline-variant p-space-lg text-center">
                    <Cylinder aria-hidden="true" className="size-6 text-on-surface-variant" />
                    <span className="text-body-md font-semibold text-on-surface">Belum ada kaleng sample {d.produk}</span>
                    <span className="max-w-sm text-body-sm text-on-surface-variant">
                      Kaleng tersimpan otomatis saat bongkaran {d.produk} selesai dan density diuji.
                      {d.nextPlan ? ` Plan kirim berikutnya ${formatTanggalIso(d.nextPlan)}.` : ''}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-space-sm gap-y-0.5">
                      <span className="text-tag uppercase text-on-surface-variant">Kaleng tersimpan: kiri terbaru, kanan terlama</span>
                      <span className={cn('text-body-sm', d.cans.length < 3 ? 'font-semibold text-amber-700' : 'text-on-surface-variant')}>
                        {d.cans.length < 3 ? `${d.cans.length} kaleng terisi, ${3 - d.cans.length} slot kosong` : 'Retensi 3 bongkaran terakhir'}
                      </span>
                    </div>
                    {/* HP: geser ke samping; layar lebar: tiga kolom. */}
                    <ol className="-mx-space-md flex snap-x snap-mandatory gap-space-sm overflow-x-auto px-space-md pb-space-xs pt-space-xs [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
                      {[0, 1, 2].map((slot) => {
                        const k = d.cans[slot]
                        return (
                          <li key={slot} className="w-[85%] shrink-0 snap-start md:w-auto">
                            {k ? (
                              <KalengCard k={k} slot={slot} onOpen={() => setDetail({ k, slot })} />
                            ) : (
                              <SlotKosong slot={slot} nextPlan={d.nextPlan} />
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  </>
                )}
              </div>
            )}
          </GlassCard>
        )
      })}

      <GlassCard level={1} className="flex gap-space-sm p-space-md">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex flex-col gap-0.5">
          <span className="text-body-md font-bold text-on-surface">Ketentuan kaleng sample</span>
          <span className="text-body-sm text-on-surface-variant">
            Setiap penerimaan mobil tangki diambil sampel dari kompartemen, diuji density dan suhu, lalu dibanding D15 dokumen depot. Sampel disimpan dalam kaleng bersegel sampai 3
            bongkaran berikutnya untuk produk yang sama; kaleng terlama dibuang saat kaleng baru masuk.
          </span>
        </div>
      </GlassCard>

      <KalengDetail open={detail} onClose={() => setDetail(null)} />
    </section>
  )
}

function Ringkas({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' | 'wait' }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-md px-space-sm py-space-xs',
        tone === 'ok' ? 'bg-tertiary-fixed/40' : tone === 'bad' ? 'bg-error-container/60' : tone === 'wait' ? 'bg-secondary-fixed/40' : 'bg-surface-container-low/80',
      )}
    >
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className={cn('tabular text-body-md font-bold', tone === 'bad' ? 'text-error' : 'text-on-surface')}>{value}</dd>
    </div>
  )
}

/** Ilustrasi kaleng: tutup, label kode, dan isi berwarna produk. */
function Can({ kode, produk, besar }: { kode: string; produk: string; besar?: boolean }) {
  const meta = produkMeta(produk)
  return (
    <span aria-hidden="true" className={cn('relative flex shrink-0 flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-sm', besar ? 'h-16 w-14' : 'h-14 w-12')}>
      <span className="mx-1.5 mt-1.5 h-1.5 rounded-full bg-on-surface-variant/50" />
      <span className="mx-1 mt-1 rounded-sm border border-outline-variant/70 bg-white px-0.5 text-center font-mono text-[9px] font-semibold leading-4 text-on-surface">{kode}</span>
      <span className={cn('mt-auto h-1/3 w-full', meta.isi)} />
    </span>
  )
}

function KalengCard({ k, slot, onOpen }: { k: Kaleng; slot: number; onOpen: () => void }) {
  const meta = produkMeta(k.produk)
  const ok = k.densityOk !== false
  const komp = k.kompartemen?.length ? ` / Komp. ${k.kompartemen.join(', ')}` : ''
  const verdict = k.selisih === null ? 'tanpa D15 depot' : ok ? 'Sesuai' : 'Tidak sesuai'

  if (slot === 0)
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'relative flex h-full w-full flex-col gap-space-sm rounded-lg border-2 bg-surface-container-lowest/90 p-space-sm pt-space-md text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
          ok ? meta.garis : 'border-error',
        )}
      >
        <span className={cn('absolute -top-2.5 left-space-sm rounded-full px-2 py-0.5 text-tag uppercase text-white', ok ? 'bg-on-surface' : 'bg-error')}>Kaleng 1, terbaru</span>
        {k.segelOk && (
          <span className="absolute -top-2.5 right-space-sm rounded-full border border-tertiary/30 bg-tertiary-fixed px-2 py-0.5 text-tag uppercase text-on-tertiary-fixed-variant">Segel sesuai</span>
        )}
        <span className="flex items-start gap-space-sm">
          <Can kode={k.kalengId.split('-')[1]} produk={k.produk} besar />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tabular truncate text-body-sm text-on-surface-variant">{k.kalengId}</span>
            <span className="tabular text-numeric-md font-bold text-on-surface">
              {formatDensity(k.d15)} <span className="text-body-sm font-normal text-on-surface-variant">g/ml</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
              <span className={cn('tabular rounded-sm px-1 font-semibold', ok ? 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant' : 'bg-error-container text-error')}>
                {k.selisih !== null ? formatDensitySigned(k.selisih) : '-'}
              </span>
              <span className="tabular text-on-surface-variant">vs depot {formatDensity(k.d15Depot)}</span>
            </span>
          </span>
        </span>
        <dl className="flex flex-col gap-1 border-t border-outline-variant/40 pt-space-xs text-body-sm">
          <Baris label="Waktu bongkar" value={`${formatTanggalIso(k.tanggal)}, ${k.jam || '-'}`} />
          <Baris label="Mobil tangki" value={`${k.nopol || '-'}${komp}`} />
          <Baris label="Petugas" value={k.petugas || '-'} />
        </dl>
        <span className="flex items-center justify-center gap-1 text-body-sm font-semibold text-primary">
          <Eye aria-hidden="true" className="size-4" />
          Lihat detail uji
        </span>
      </button>
    )

  return (
    <button type="button" onClick={onOpen} className="flex h-full w-full flex-col gap-space-sm rounded-lg border border-outline-variant/70 bg-surface-container-lowest/80 p-space-sm text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex items-start gap-space-sm">
        <Can kode={`K${slot + 1}`} produk={k.produk} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2 text-body-sm text-on-surface-variant">
            <span>Kaleng {slot + 1}</span>
            <span className="tabular">{formatTanggalIso(k.tanggal)}</span>
          </span>
          <span className="tabular text-numeric-sm font-bold text-on-surface">
            {formatDensity(k.d15)} <span className="text-body-sm font-normal text-on-surface-variant">g/ml</span>
          </span>
          <span className={cn('tabular text-body-sm', ok ? 'text-on-surface-variant' : 'font-semibold text-error')}>
            {k.selisih !== null ? formatDensitySigned(k.selisih) : '-'} ({verdict})
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
      </span>
      <dl className="flex flex-col gap-1 border-t border-outline-variant/40 pt-space-xs text-body-sm">
        <Baris label="Jam" value={k.jam || '-'} />
        <Baris label="Armada" value={`${k.nopol || '-'}${komp}`} />
        {slot === 1 ? (
          <Baris label="Uji air" value={k.airNihil === true ? 'Nihil' : k.airNihil === false ? 'Ada air, didraining' : '-'} tone={k.airNihil === false ? 'bad' : undefined} />
        ) : (
          <Baris label="Retensi" value="Dibuang saat kaleng baru masuk" tone="wait" />
        )}
      </dl>
    </button>
  )
}

function SlotKosong({ slot, nextPlan }: { slot: number; nextPlan: string | null }) {
  return (
    <div className="flex h-full min-h-44 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant p-space-sm text-center">
      <CirclePlus aria-hidden="true" className="mb-1 size-6 text-on-surface-variant/70" />
      <span className="text-body-md font-semibold text-on-surface">Slot kaleng {slot + 1} kosong</span>
      <span className="text-body-sm text-on-surface-variant">Menunggu bongkaran berikutnya</span>
      <span className="tabular mt-1 rounded-sm bg-surface-container-low px-2 py-0.5 text-body-sm text-on-surface-variant">
        {nextPlan ? `Plan kirim ${formatTanggalIso(nextPlan)}` : 'Belum ada plan kirim'}
      </span>
    </div>
  )
}

function Baris({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'wait' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-on-surface-variant">{label}</dt>
      <dd className={cn('tabular truncate text-right', tone === 'bad' ? 'font-semibold text-error' : tone === 'wait' ? 'text-amber-700' : 'text-on-surface')}>{value}</dd>
    </div>
  )
}
