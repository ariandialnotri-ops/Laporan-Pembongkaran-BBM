import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, CircleDashed, CirclePlus, Clock, Cylinder, Eye, Fuel, Info, TriangleAlert } from 'lucide-react'
import { KalengDetail } from '@/components/bongkaran/kaleng-detail'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { produkMeta } from '@/lib/produk'
import { kalengSample, type Kaleng, type KalengStatus } from '@/lib/ringkasan'
import { sampleMenunggu } from '@/lib/sample'
import { tankForProduk, tankName } from '@/lib/tank'
import { cn } from '@/lib/utils'

const STATUS: Record<KalengStatus, { label: string; tone: 'success' | 'error' | 'neutral' | 'cyan'; icon: typeof CircleCheck }> = {
  sesuai: { label: 'Sesuai', tone: 'success', icon: CircleCheck },
  perhatian: { label: 'Ada anomali', tone: 'error', icon: TriangleAlert },
  menunggu: { label: 'D15 belum ada', tone: 'cyan', icon: Clock },
  belum: { label: 'Belum ada sampel', tone: 'neutral', icon: CircleDashed },
}

const jamDari = (ms: number) => new Date(ms).toTimeString().slice(0, 5)

/**
 * Kaleng Sample: 3 bongkaran selesai terakhir per produk (kiri terbaru, kanan terlama).
 * Isi kaleng = sample mobil tangki yang diuji saat bongkar, dibanding D15 dokumen depot.
 */
export function KalengSample() {
  const app = useApp()
  const data = useMemo(() => kalengSample(app.reports, app.plans, app.usedLoIds), [app.reports, app.plans, app.usedLoIds])
  const [buka, setBuka] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<{ k: Kaleng; slot: number } | null>(null)
  const [sop, setSop] = useState(false)

  const sesuai = data.filter((d) => d.status === 'sesuai').length
  const anomali = data.filter((d) => d.status === 'perhatian').length
  // Uji pasca penerimaan (tangki pendam) terpisah dari kaleng, tetapi tetap wajib.
  const pasca = sampleMenunggu(app.reports).length
  const terbaru = Math.max(0, ...data.flatMap((d) => d.cans.map((c) => c.updatedAt)))
  const tol = formatDensity(app.rules.densityTolerance)

  return (
    <section aria-labelledby="kaleng-sample" className="flex flex-col gap-space-sm">
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Cylinder className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="kaleng-sample" className="text-headline-md font-bold text-on-surface">
              Kaleng Sample
            </h2>
            <span className="text-body-sm text-on-surface-variant">
              D15 sample mobil tangki (diuji saat bongkar) dari 3 bongkaran terakhir tiap produk, dibanding D15 depot (toleransi ±<span className="tabular">{tol}</span>).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSop(true)}
            aria-label="Ketentuan kaleng sample"
            className="glass-1 flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition-transform active:scale-95"
          >
            <Info aria-hidden="true" className="size-5" />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-space-xs border-t border-outline-variant/40 pt-space-sm lg:grid-cols-4">
          <Ringkas label="Sampel sesuai" value={`${sesuai} dari ${data.length} produk`} tone="ok" />
          <Ringkas label="Ada anomali" value={`${anomali} produk`} tone={anomali ? 'bad' : undefined} />
          <Ringkas label="Belum uji pasca penerimaan" value={`${pasca} penerimaan`} tone={pasca ? 'wait' : undefined} />
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
                  <span className="truncate text-body-sm text-on-surface-variant">{tank ? tankName(tank.tankNo) : 'Tangki belum diatur'}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center justify-between gap-space-sm md:justify-end">
                {latest ? (
                  <span className="flex gap-space-md">
                    <span className="flex flex-col md:items-end">
                      <span className="text-tag uppercase text-on-surface-variant">D15 terkini</span>
                      {latest.menunggu ? (
                        <span className="text-body-sm font-semibold text-on-secondary-fixed-variant">D15 belum ada</span>
                      ) : (
                        <span className="tabular text-body-sm font-bold text-on-surface">
                          {formatDensity(latest.d15Sample)}{' '}
                          <span className={cn('font-semibold', latest.ok === false ? 'text-error' : 'text-primary')}>({latest.selisih !== null ? formatDensitySigned(latest.selisih) : '-'})</span>
                        </span>
                      )}
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
                      Kaleng tersimpan saat bongkaran {d.produk} selesai.
                      {d.nextPlan ? ` Plan kirim berikutnya ${formatTanggalIso(d.nextPlan)}.` : ''}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-space-sm gap-y-0.5">
                      <span className="text-tag uppercase text-on-surface-variant">Kiri terbaru, kanan terlama</span>
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
                            {k ? <KalengCard k={k} slot={slot} onOpen={() => setDetail({ k, slot })} /> : <SlotKosong slot={slot} nextPlan={d.nextPlan} />}
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

      <Sheet open={sop} onOpenChange={setSop} title="Ketentuan kaleng sample" description="Pemantauan mutu BBM tiap penerimaan.">
        <ol className="flex list-decimal flex-col gap-space-xs pl-5 text-body-md text-on-surface">
          <li>Setiap penerimaan, sampel diambil dari kompartemen mobil tangki saat bongkar, diuji density dan suhu, lalu D15-nya dibanding D15 dokumen depot. Sampel inilah isi kaleng sample.</li>
          <li>Setelah bongkar selesai, wajib uji kualitas pasca penerimaan dari tangki pendam (menu Input). Jam uji diatur petugas; hasilnya dicatat terpisah dari kaleng.</li>
          <li>
            Selisih D15 maksimal ±<span className="tabular">{tol}</span>. Di luar itu, kaleng ditandai anomali.
          </li>
          <li>Sampel disimpan dalam kaleng bersegel sampai 3 bongkaran berikutnya untuk produk yang sama; kaleng terlama dibuang saat kaleng baru masuk.</li>
        </ol>
      </Sheet>

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

/** Ilustrasi kaleng: tutup, label, dan isi berwarna produk. */
function Can({ label, produk, besar }: { label: string; produk: string; besar?: boolean }) {
  const meta = produkMeta(produk)
  return (
    <span aria-hidden="true" className={cn('relative flex shrink-0 flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-sm', besar ? 'h-16 w-14' : 'h-14 w-12')}>
      <span className="mx-1.5 mt-1.5 h-1.5 rounded-full bg-on-surface-variant/50" />
      <span className="mx-1 mt-1 rounded-sm border border-outline-variant/70 bg-white px-0.5 text-center font-mono text-[10px] font-semibold leading-4 text-on-surface">{label}</span>
      <span className={cn('mt-auto h-1/3 w-full', meta.isi)} />
    </span>
  )
}

/** D15 sample mobil tangki (uji saat bongkar), dibanding D15 depot. */
function NilaiSample({ k, besar }: { k: Kaleng; besar?: boolean }) {
  if (k.menunggu)
    return (
      <span className="flex flex-col">
        <span className="flex items-center gap-1 text-body-sm font-semibold text-on-secondary-fixed-variant">
          <Clock aria-hidden="true" className="size-4" />
          D15 sample MT belum ada
        </span>
        <span className="tabular text-body-sm text-on-surface-variant">D15 depot {formatDensity(k.d15Depot)}</span>
      </span>
    )
  const ok = k.ok !== false
  return (
    <span className="flex flex-col">
      <span className={cn('tabular font-bold text-on-surface', besar ? 'text-numeric-md' : 'text-numeric-sm')}>
        {formatDensity(k.d15Sample)} <span className="text-body-sm font-normal text-on-surface-variant">g/ml</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
        <span className={cn('tabular rounded-sm px-1 font-semibold', ok ? 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant' : 'bg-error-container text-error')}>
          {k.selisih !== null ? formatDensitySigned(k.selisih) : '-'}
        </span>
        <span className="tabular text-on-surface-variant">vs depot {formatDensity(k.d15Depot)}</span>
      </span>
    </span>
  )
}

function KalengCard({ k, slot, onOpen }: { k: Kaleng; slot: number; onOpen: () => void }) {
  const meta = produkMeta(k.produk)
  const bad = k.ok === false
  const komp = k.kompartemen?.length ? ` / Komp. ${k.kompartemen.join(', ')}` : ''
  const terbaru = slot === 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'relative flex h-full w-full flex-col gap-space-sm rounded-lg bg-surface-container-lowest/90 p-space-sm text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        terbaru ? cn('border-2 pt-space-md', bad ? 'border-error' : meta.garis) : 'border border-outline-variant/70',
      )}
    >
      {terbaru && (
        <span className={cn('absolute -top-2.5 left-space-sm rounded-full px-2 py-0.5 text-tag uppercase text-white', bad ? 'bg-error' : 'bg-on-surface')}>Kaleng 1, terbaru</span>
      )}
      {terbaru && k.segelOk && (
        <span className="absolute -top-2.5 right-space-sm rounded-full border border-tertiary/30 bg-tertiary-fixed px-2 py-0.5 text-tag uppercase text-on-tertiary-fixed-variant">Segel sesuai</span>
      )}
      <span className="flex items-start gap-space-sm">
        <Can label={`K${slot + 1}`} produk={k.produk} besar={terbaru} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm font-semibold text-on-surface-variant">Kaleng {slot + 1}</span>
          <NilaiSample k={k} besar={terbaru} />
        </span>
        {!terbaru && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />}
      </span>
      <dl className="mt-auto flex flex-col gap-1 border-t border-outline-variant/40 pt-space-xs text-body-sm">
        <Baris label="Waktu bongkar" value={`${formatTanggalIso(k.tanggal)}, ${k.jam || '-'}`} />
        <Baris label="No SO" value={k.noSO || '-'} />
        <Baris label="No LO" value={k.noLOs.join(', ') || '-'} />
        <Baris label="Mobil tangki" value={`${k.nopol || '-'}${komp}`} />
        {slot === 2 && <Baris label="Retensi" value="Dibuang saat kaleng baru masuk" tone="wait" />}
      </dl>
      {terbaru && (
        <span className="flex items-center justify-center gap-1 text-body-sm font-semibold text-primary">
          <Eye aria-hidden="true" className="size-4" />
          Lihat detail uji
        </span>
      )}
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
