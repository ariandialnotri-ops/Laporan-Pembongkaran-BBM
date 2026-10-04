import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Droplets, FileText, FlaskConical, LoaderCircle, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { METHOD_LABEL } from '@/lib/density'
import { formatDensity, formatDensitySigned, formatNumber, parseAngka } from '@/lib/format'
import { planSupply } from '@/lib/plan'
import type { Kaleng } from '@/lib/ringkasan'
import { evaluateAll, normalizeReport, SIGNERS, type Derived, type Report } from '@/lib/sop'
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
  const ok = k ? k.densityOk !== false : true

  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setError(null)
        }
      }}
      title={k ? `Detail uji ${k.kalengId}` : 'Detail uji'}
      description={k ? `${k.produk}, kaleng ${open!.slot + 1} dari 3. ${app.settings.namaSpbu}` : undefined}
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
      {k && (
        <Pill tone={ok ? 'success' : 'error'} className="self-start">
          {ok ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          {ok ? 'Lolos uji, selisih dalam toleransi' : 'Selisih di luar toleransi'}
        </Pill>
      )}
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
  const komp = d.compartments.map((c) => `${c.no || '-'}${parseAngka(c.kapasitas) ? ` (${formatNumber(parseAngka(c.kapasitas)!)} L)` : ''}`).join(', ')
  const segel = d.compartments.map((c) => c.noSegel).filter(Boolean)
  const tol = app.rules.densityTolerance
  const ttd = SIGNERS.map((s) => ({ s, t: d.ttd?.[s.key] })).filter((v) => v.t?.img)

  return (
    <>
      <Bagian no={1} title="Penerimaan & mobil tangki">
        <Grid>
          <Item label="Nomor polisi" value={d.nopol || '-'} sub={komp ? `Komp. ${komp}` : undefined} />
          <Item label="No SO / LO" value={[d.noSO, ...d.noLOs].filter(Boolean).join(' / ') || '-'} sub={plan ? planSupply(plan, lo) || undefined : undefined} />
          <Item label="Datang & selesai bongkar" value={`${formatTanggalIso(d.tanggalDatang)}, ${d.jamDatang || '-'}`} sub={d.jamSelesaiBongkar ? `Selesai ${d.jamSelesaiBongkar}` : undefined} />
          <Item label="Tangki tujuan" value={x.tank ? x.tank.label : '-'} sub={x.tank ? `Kapasitas ${formatNumber(x.tank.capacity)} L` : undefined} />
          <Item label="Driver" value={d.namaDriver || '-'} sub={d.perusahaanPengangkut || undefined} />
          <Item label="Suhu tangki (ATG)" value={d.atgBefore.suhu ? `${d.atgBefore.suhu} °C` : '-'} />
        </Grid>
      </Bagian>

      <Bagian no={2} title="Parameter uji density" aside={`Toleransi ±${formatDensity(tol)}`}>
        <div className="flex flex-col gap-space-xs">
          {x.densityResults.map((r) => (
            <div key={r.id} className={cn('flex flex-col gap-space-xs rounded-md border p-space-sm', r.ok === false ? 'border-error/40 bg-error-container/40' : 'border-outline-variant/60 bg-surface-container-lowest/70')}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-body-sm font-bold text-on-surface">
                  <FlaskConical aria-hidden="true" className="size-4 text-primary" />
                  Kompartemen {r.kompartemenNo}
                </span>
                {r.ok === null ? <Pill>Tanpa acuan</Pill> : r.ok ? <Pill tone="success">Sesuai</Pill> : <Pill tone="error">Tidak sesuai</Pill>}
              </div>
              <Grid>
                <Item label="Density teramati" value={r.obs !== null ? `${formatDensity(r.obs)} g/ml` : '-'} sub={r.suhu ? `pada ${r.suhu} °C` : undefined} />
                <Item label="D15 dokumen depot" value={`${formatDensity(x.d15Depot)} g/ml`} sub={x.depotCalc ? `Hitungan depot ${formatDensity(x.depotCalc.value)}` : undefined} />
                <Item label="D15 hasil hitung" value={`${formatDensity(r.d15?.value)} g/ml`} sub={r.d15 ? METHOD_LABEL[r.d15.method] : undefined} />
                <Item label="Selisih" value={r.selisih !== null ? formatDensitySigned(r.selisih) : '-'} tone={r.ok === false ? 'bad' : 'ok'} />
              </Grid>
            </div>
          ))}
          {x.densityResults.length === 0 && <p className="text-body-sm text-on-surface-variant">Belum ada pengukuran density.</p>}
          <div className="flex flex-col gap-1 rounded-md bg-surface-container-low/70 p-space-sm text-body-sm">
            <span className="flex items-center gap-1.5 font-bold text-on-surface">
              <Droplets aria-hidden="true" className="size-4 text-primary" />
              Air & sampel
            </span>
            <Row label="Water content (pasta air)" value={d.airNihil === true ? 'Nihil' : d.airNihil === false ? 'Ada air, sudah didraining' : '-'} bad={d.airNihil === false} />
            <Row label="Sampel atas & bawah" value={d.sampelSesuai ? 'Sesuai' : 'Belum dikonfirmasi'} />
            {x.sample2Jam && (
              <Row
                label="Sample tangki 2 jam"
                value={`D15 ${formatDensity(x.sample2Jam.d15?.value)} (${x.sample2Jam.selisih !== null ? formatDensitySigned(x.sample2Jam.selisih) : '-'})`}
                bad={x.sample2Jam.ok === false}
              />
            )}
          </div>
        </div>
      </Bagian>

      <Bagian no={3} title="Segel & retensi kaleng">
        <Grid>
          <Item label="Nomor segel" value={segel.length ? segel.join(', ') : '-'} />
          <Item label="Kondisi segel" value={d.segelSesuai ? 'Utuh, sesuai data LO' : 'Belum dikonfirmasi'} tone={d.segelSesuai ? 'ok' : undefined} />
          <Item label="Posisi kaleng" value={`Kaleng ${slot + 1} dari 3`} />
          <Item
            label="Masa simpan"
            value={slot === 2 ? 'Dibuang saat kaleng baru masuk' : `Sampai ${3 - slot} bongkaran ${k.produk} lagi`}
            tone={slot === 2 ? 'wait' : undefined}
          />
        </Grid>
      </Bagian>

      <Bagian no={4} title="Tanda tangan">
        {ttd.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">Belum ada tanda tangan.</p>
        ) : (
          <div className="grid grid-cols-2 gap-space-xs">
            {ttd.map(({ s, t }) => (
              <figure key={s.key} className="flex flex-col items-center gap-1 rounded-md border border-outline-variant/60 bg-white/80 p-space-xs text-center">
                <figcaption className="text-tag uppercase text-on-surface-variant">{s.label}</figcaption>
                <img src={t!.img} alt={`Tanda tangan ${s.label}`} className="h-12 max-w-full object-contain" />
                <span className="text-body-sm font-semibold text-on-surface">{t!.nama || '-'}</span>
              </figure>
            ))}
          </div>
        )}
      </Bagian>
    </>
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

function Item({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' | 'wait' }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className={cn('tabular break-words text-body-sm font-semibold', tone === 'bad' ? 'text-error' : tone === 'ok' ? 'text-primary' : tone === 'wait' ? 'text-amber-700' : 'text-on-surface')}>{value}</dd>
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
