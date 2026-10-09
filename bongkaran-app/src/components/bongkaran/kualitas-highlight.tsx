import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Truck, TriangleAlert } from 'lucide-react'
import { ProdukChip } from '@/components/bongkaran/record-table'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { qqD15, type QqRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { acuanD15 } from '@/lib/ringkasan'
import type { Photo, Report } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

/** Kunci satu hasil uji: harian `h.<recordId>.<barisId>` atau pasca penerimaan `p.<reportId>`. */
export const kunciHarian = (recId: string, kualitasId: string) => `h.${recId}.${kualitasId}`
export const kunciPasca = (reportId: string) => `p.${reportId}`

type Uji = {
  jenis: string
  produk: string
  tanggal: string
  waktu: string
  petugas: string
  densityObs: string
  suhu: string
  d15: number | null
  acuan: number | null
  acuanLabel: string
  selisih: number | null
  ok: boolean | null
  catatan: string
  foto: Photo[]
}

/**
 * Ringkasan satu hasil uji kualitas (highlight): D15, selisih terhadap acuan, status,
 * lalu detail pengukuran. Info bongkaran terkait (uji pasca penerimaan) tampil kecil.
 */
export function KualitasHighlight({ kunci }: { kunci: string }) {
  const app = useApp()
  const [report, setReport] = useState<Report | null | undefined>(undefined)
  const [jenis, a, b] = kunci.split('.')
  const pasca = jenis === 'p'
  const summary = pasca ? app.reports.find((r) => r.id === a) : undefined

  useEffect(() => {
    if (!pasca || !a) return
    let hidup = true
    app.backend.getReport(a).then(
      (r) => hidup && setReport(r),
      () => hidup && setReport(null),
    )
    return () => {
      hidup = false
    }
  }, [pasca, a, app.backend])

  let uji: Uji | null = null
  if (!pasca) {
    const rec = app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === a)
    const k = rec?.data.kualitas.find((x) => x.id === b)
    if (rec && k) {
      const d15 = qqD15(k).d15?.value ?? null
      const ref = acuanD15(app.reports, k.produk, rec.tanggal)
      const selisih = d15 !== null && ref ? Math.round((d15 - ref.d15) * 10000) / 10000 : null
      uji = {
        jenis: 'Uji kualitas harian',
        produk: k.produk,
        tanggal: rec.tanggal,
        waktu: `Shift ${rec.shift}${rec.data.jam ? `, ${rec.data.jam}` : ''}`,
        petugas: rec.data.petugas,
        densityObs: k.densityObs,
        suhu: k.suhu,
        d15,
        acuan: ref?.d15 ?? null,
        acuanLabel: ref ? `D15 bongkar ${formatTanggalIso(ref.tanggal)}` : 'Belum ada bongkaran',
        selisih,
        ok: selisih !== null ? Math.abs(selisih) <= app.rules.densityTolerance + 1e-9 : null,
        catatan: rec.data.catatan,
        foto: [...(rec.data.foto?.kualitasStruk ?? []), ...(rec.data.foto?.kualitasKembali ?? [])],
      }
    }
  } else if (summary?.sample2Jam) {
    const s = report?.data.sample2Jam
    const depot = Number(String(report?.data.density15Depot ?? '').replace(',', '.'))
    uji = {
      jenis: 'Uji kualitas pasca penerimaan',
      produk: summary.produk,
      tanggal: summary.sample2Jam.tanggal,
      waktu: summary.sample2Jam.jam,
      petugas: s?.petugas ?? '',
      densityObs: s?.densityObs ?? '',
      suhu: s?.suhu ?? '',
      d15: summary.sample2Jam.d15,
      acuan: Number.isFinite(depot) && depot > 0 ? depot : null,
      acuanLabel: 'D15 dokumen depot',
      selisih: summary.sample2Jam.selisih,
      ok: summary.sample2Jam.ok,
      catatan: s?.catatan ?? '',
      foto: [],
    }
  }

  const srcOf = usePhotoSrc(uji?.foto ?? [])
  if (!uji) return <p className="p-space-md text-center text-body-sm text-on-surface-variant">Data uji tidak ditemukan (mungkin sudah dihapus).</p>

  const tone = uji.ok === false ? 'bad' : uji.ok ? 'ok' : 'none'
  const ttd = report ? Object.values(report.data.ttd ?? {}).filter((t) => t?.img).length : null

  return (
    <div className="flex flex-col gap-space-sm">
      {/* Highlight */}
      <div className={cn('flex flex-col gap-space-sm rounded-lg p-space-md', tone === 'bad' ? 'bg-error-container/60' : tone === 'ok' ? 'bg-emerald-50' : 'bg-surface-container-low')}>
        <div className="flex flex-wrap items-center gap-space-xs">
          <ProdukChip produk={uji.produk} />
          <span className="text-body-sm font-semibold text-on-surface-variant">{uji.jenis}</span>
        </div>
        <div className="flex items-end justify-between gap-space-sm">
          <div className="flex flex-col">
            <span className="text-tag uppercase text-on-surface-variant">D15</span>
            <span className="tabular text-[2.5rem] font-bold leading-none text-on-surface">{formatDensity(uji.d15)}</span>
            <span className="text-body-sm text-on-surface-variant">g/ml</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {uji.ok === null ? (
              <Pill>Tanpa acuan</Pill>
            ) : uji.ok ? (
              <Pill tone="success">
                <CircleCheck aria-hidden="true" />
                Sesuai
              </Pill>
            ) : (
              <Pill tone="error">
                <TriangleAlert aria-hidden="true" />
                Tidak sesuai
              </Pill>
            )}
            <span className={cn('tabular text-numeric-lg font-bold', tone === 'bad' ? 'text-error' : tone === 'ok' ? 'text-emerald-700' : 'text-on-surface-variant')}>
              {uji.selisih !== null ? formatDensitySigned(uji.selisih) : '-'}
            </span>
            <span className="text-body-sm text-on-surface-variant">vs acuan, toleransi ±{formatDensity(app.rules.densityTolerance)}</span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs rounded-lg bg-surface-container-lowest/80 p-space-sm text-body-sm">
        <Info label="Tanggal" value={formatTanggalIso(uji.tanggal)} />
        <Info label="Waktu" value={uji.waktu || '-'} />
        <Info label="Density observasi" value={uji.densityObs ? `${uji.densityObs} g/ml` : '-'} />
        <Info label="Suhu" value={uji.suhu ? `${uji.suhu} °C` : '-'} />
        <Info label="Acuan" value={`${formatDensity(uji.acuan)} (${uji.acuanLabel})`} />
        <Info label="Petugas" value={uji.petugas || (pasca && report === undefined ? 'memuat…' : '-')} />
        {uji.catatan && <Info label="Catatan" value={uji.catatan} wide />}
      </dl>

      {uji.foto.length > 0 && (
        <div className="flex gap-space-xs overflow-x-auto">
          {uji.foto.map((p) => {
            const src = srcOf(p)
            return src ? (
              <a key={p.id} href={src} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={src} alt="Foto uji" className="size-16 rounded-md object-cover" />
              </a>
            ) : (
              <span key={p.id} className="size-16 shrink-0 animate-pulse rounded-md bg-surface-container" />
            )
          })}
        </div>
      )}

      {/* Info minor: bongkaran terkait uji pasca penerimaan. */}
      {pasca && summary && (
        <div className="flex items-center gap-space-xs rounded-md bg-surface-container-low/70 px-space-sm py-1.5 text-body-sm text-on-surface-variant">
          <Truck aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Bongkaran {summary.nopol || '-'}, {formatTanggalIso(summary.tanggal)}
            {ttd !== null ? `, TTD ${ttd}/5` : ''}
          </span>
          <Link to={`/input/${summary.id}`} className="shrink-0 font-semibold text-primary">
            Buka
          </Link>
        </div>
      )}
    </div>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col', wide && 'col-span-2')}>
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="tabular break-words font-semibold text-on-surface">{value}</dd>
    </div>
  )
}
