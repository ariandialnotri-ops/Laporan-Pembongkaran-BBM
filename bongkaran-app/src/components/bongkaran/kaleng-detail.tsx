import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Clock, Droplets, FileText, LoaderCircle, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { normalizeDensity } from '@/lib/density'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { planSupply } from '@/lib/plan'
import type { Kaleng } from '@/lib/ringkasan'
import { evaluateAll, normalizeReport, type Derived, type Report } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Detail uji satu kaleng sample, diambil dari data bongkaran lengkap. */
export function KalengDetail({ open, onClose }: { open: { k: Kaleng; slot: number } | null; onClose: () => void }) {
  const app = useApp()
  const [data, setData] = useState<{ id: string; report: Report; x: Derived } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = open?.k.id ?? null

  useEffect(() => {
    if (!id) return
    let alive = true
    app.backend
      .getReport(id)
      .then((raw) => {
        if (!alive) return
        if (!raw) return setError('Data bongkaran tidak ditemukan.')
        const report = normalizeReport(raw)
        setData({ id, report, x: evaluateAll(report, app.rules).derived })
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, app.backend, app.rules])

  const k = open?.k
  const loaded = data && data.id === id ? data : null

  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setError(null)
        }
      }}
      title={k ? `Kaleng ${open!.slot + 1} ${k.produk}` : 'Detail uji'}
      description="Detail uji kaleng sample"
      footer={
        k && (
          <>
            <Link to={`/input/${k.id}`} onClick={onClose} className={cn(buttonVariants({ variant: 'glass', size: 'lg' }), 'flex-1')}>
              <FileText aria-hidden="true" />
              Berita Acara
            </Link>
            <button type="button" onClick={onClose} className={cn(buttonVariants({ size: 'lg' }), 'flex-1')}>
              Tutup
            </button>
          </>
        )
      }
    >
      {k &&
        (k.menunggu ? (
          <Pill tone="cyan" className="self-start">
            <Clock aria-hidden="true" />
            Menunggu sample 2 jam
          </Pill>
        ) : (
          <Pill tone={k.ok === false ? 'error' : 'success'} className="self-start">
            {k.ok === false ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
            {k.ok === false ? 'Selisih di luar toleransi' : 'Lolos uji, selisih dalam toleransi'}
          </Pill>
        ))}
      {error && <p className="text-body-sm font-semibold text-error">{error}</p>}
      {!loaded && !error && (
        <div className="flex items-center gap-space-xs text-body-sm text-on-surface-variant">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Memuat data bongkaran…
        </div>
      )}
      {k && loaded && <Isi k={k} slot={open!.slot} report={loaded.report} x={loaded.x} />}
    </Sheet>
  )
}

function Isi({ k, slot, report, x }: { k: Kaleng; slot: number; report: Report; x: Derived }) {
  const app = useApp()
  const d = report.data
  const plan = app.plans.find((p) => p.id === d.planId)
  const lo = plan?.los.find((l) => d.loIds.includes(l.id))
  const supply = plan ? planSupply(plan, lo) : ''
  const sample = d.sample2Jam
  const tol = app.rules.densityTolerance

  return (
    <>
      <Bagian no={1} title="Data DO mobil tangki">
        <Grid>
          <Item label="Nomor SO" value={d.noSO || '-'} strong />
          <Item label="Nomor LO" value={d.noLOs.join(', ') || '-'} strong />
          <Item label="Tanggal & waktu penerimaan" value={`${formatTanggalIso(d.tanggalDatang)}, ${d.jamDatang || '-'}`} sub={d.jamSelesaiBongkar ? `Selesai bongkar ${d.jamSelesaiBongkar}` : undefined} />
          <Item label="Supply point" value={supply || '-'} />
          <Item label="Nopol" value={d.nopol || '-'} />
          <Item label="Driver" value={d.namaDriver || '-'} sub={d.perusahaanPengangkut || undefined} />
          <Item label="Tangki tujuan" value={x.tank ? x.tank.label : '-'} />
        </Grid>
        {d.compartments.length > 0 && (
          <div className="overflow-hidden rounded-md border border-outline-variant/60">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low/80 text-tag uppercase text-on-surface-variant">
                <tr>
                  <th scope="col" className="px-space-sm py-space-xs font-semibold">Kompartemen</th>
                  <th scope="col" className="px-space-sm py-space-xs font-semibold">Nomor segel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {d.compartments.map((c) => (
                  <tr key={c.id}>
                    <td className="px-space-sm py-space-xs text-on-surface">{c.no || '-'}</td>
                    <td className="tabular px-space-sm py-space-xs font-semibold text-on-surface">{c.noSegel || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>

      <Bagian no={2} title="Parameter uji density" aside={`Toleransi ±${formatDensity(tol)}`}>
        {/* Acuan kaleng: sample tangki 2 jam. */}
        <UjiDensity
          title="Sample tangki 2 jam (acuan kaleng)"
          obs={sample ? normalizeDensity(sample.densityObs) : null}
          suhu={sample?.suhu}
          hasilLabel="D15 sample"
          hasil={x.sample2Jam?.d15?.value ?? null}
          selisih={x.sample2Jam?.selisih ?? null}
          ok={x.sample2Jam?.ok ?? null}
          kosong={!sample ? 'Sample 2 jam belum diambil (menu Input, Sample BBM 2 Jam).' : undefined}
          waktu={sample ? `${formatTanggalIso(sample.tanggal)}, ${sample.jam}` : undefined}
        />
        <UjiDensity
          title="D15 dokumen depot"
          obs={normalizeDensity(d.densityObsDepot)}
          suhu={d.suhuObsDepot}
          hasilLabel="D15 depot"
          hasil={x.d15Depot}
        />
        {x.densityResults.map((r) => (
          <UjiDensity
            key={r.id}
            title={`Uji saat bongkar, kompartemen ${r.kompartemenNo}`}
            obs={r.obs}
            suhu={r.suhu}
            hasilLabel="D15 bongkar"
            hasil={r.d15?.value ?? null}
            selisih={r.selisih}
            ok={r.ok}
          />
        ))}
        <div className="flex flex-col gap-1 rounded-md bg-surface-container-low/70 p-space-sm text-body-sm">
          <span className="flex items-center gap-1.5 font-bold text-on-surface">
            <Droplets aria-hidden="true" className="size-4 text-primary" />
            Air & sampel
          </span>
          <Row label="Water content (pasta air)" value={d.airNihil === true ? 'Nihil' : d.airNihil === false ? 'Ada air, sudah didraining' : '-'} bad={d.airNihil === false} />
          <Row label="Sampel atas & bawah" value={d.sampelSesuai ? 'Sesuai' : 'Belum dikonfirmasi'} />
        </div>
      </Bagian>

      <Bagian no={3} title="Data retensi kaleng sampel">
        <Grid>
          <Item label="Posisi kaleng" value={`Kaleng ${slot + 1} dari 3`} />
          <Item label="Masa simpan" value={slot === 2 ? 'Dibuang saat kaleng baru masuk' : `Sampai ${3 - slot} bongkaran ${k.produk} lagi`} tone={slot === 2 ? 'wait' : undefined} />
          <Item label="Kondisi segel" value={d.segelSesuai ? 'Utuh, sesuai data LO' : 'Belum dikonfirmasi'} tone={d.segelSesuai ? 'ok' : undefined} />
          <Item label="Petugas sample 2 jam" value={sample?.petugas || '-'} />
        </Grid>
      </Bagian>
    </>
  )
}

/** Satu pengukuran: density observe, suhu di bawahnya, lalu hasil D15 yang disorot. */
function UjiDensity({
  title,
  obs,
  suhu,
  hasilLabel,
  hasil,
  selisih,
  ok,
  kosong,
  waktu,
}: {
  title: string
  obs: number | null
  suhu: string | undefined
  hasilLabel: string
  hasil: number | null
  selisih?: number | null
  ok?: boolean | null
  kosong?: string
  waktu?: string
}) {
  return (
    <div className={cn('flex flex-col gap-space-xs rounded-md border p-space-sm', ok === false ? 'border-error/40 bg-error-container/30' : 'border-outline-variant/60 bg-surface-container-lowest/70')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body-sm font-bold text-on-surface">{title}</span>
        {waktu && <span className="tabular text-body-sm text-on-surface-variant">{waktu}</span>}
      </div>
      {kosong ? (
        <p className="text-body-sm text-on-surface-variant">{kosong}</p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] items-center gap-space-sm">
          <dl className="flex flex-col gap-0.5 text-body-sm">
            <div className="flex gap-1.5">
              <dt className="text-on-surface-variant">Density observe:</dt>
              <dd className="tabular font-semibold text-on-surface">{obs !== null ? `${formatDensity(obs)} g/ml` : '-'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-on-surface-variant">Suhu:</dt>
              <dd className="tabular font-semibold text-on-surface">{suhu ? `${suhu} °C` : '-'}</dd>
            </div>
          </dl>
          <div className={cn('flex flex-col items-end rounded-md px-space-sm py-space-xs', ok === false ? 'bg-error-container' : 'bg-primary-fixed/70')}>
            <span className="text-tag uppercase text-on-surface-variant">{hasilLabel}</span>
            <span className={cn('tabular text-numeric-md font-bold', ok === false ? 'text-error' : 'text-on-primary-fixed')}>{formatDensity(hasil)}</span>
            {selisih !== undefined && (
              <span className={cn('tabular text-body-sm font-semibold', ok === false ? 'text-error' : 'text-primary')}>{selisih !== null ? `${formatDensitySigned(selisih)} vs depot` : '-'}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Bagian({ no, title, aside, children }: { no: number; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-space-xs text-body-md font-bold uppercase tracking-wide text-on-surface">
          <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary-fixed text-body-sm text-primary">{no}</span>
          {title}
        </h3>
        {aside && <span className="tabular text-body-sm text-on-surface-variant">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs rounded-md bg-surface-container-low/60 p-space-sm">{children}</dl>
}

function Item({ label, value, sub, tone, strong }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' | 'wait'; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd
        className={cn(
          'tabular break-words font-semibold',
          strong ? 'text-body-md' : 'text-body-sm',
          tone === 'bad' ? 'text-error' : tone === 'ok' ? 'text-primary' : tone === 'wait' ? 'text-amber-700' : 'text-on-surface',
        )}
      >
        {value}
      </dd>
      {sub && <dd className="text-body-sm text-on-surface-variant">{sub}</dd>}
    </div>
  )
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-on-surface-variant">{label}</span>
      <span className={cn('tabular text-right font-semibold', bad ? 'text-error' : 'text-on-surface')}>{value}</span>
    </div>
  )
}
