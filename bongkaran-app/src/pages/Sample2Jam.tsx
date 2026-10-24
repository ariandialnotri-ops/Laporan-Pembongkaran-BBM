import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BellRing, ChevronRight, CircleCheck, Clock, FlaskConical, Fuel, LoaderCircle, Send, TriangleAlert, Truck } from 'lucide-react'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { InfoHalaman } from '@/components/ui/info-pop'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { density15, normalizeDensity } from '@/lib/density'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { currentShift, shiftKey } from '@/lib/shift'
import type { StatusIsi } from '@/lib/status-isi'
import { useKeTerkirim } from '@/lib/terkirim'
import { evaluateAll, normalizeReport, PRODUK_OPTIONS, summarize, type ReportSummary, type Sample2Jam as Sample } from '@/lib/sop'
import { warnaProduk } from '@/components/dashboard/charts'
import { cn } from '@/lib/utils'

/** Jam sekarang (di luar render). */
const jamSekarang = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


/** Waktu simpan (di luar render). */
const stamp = () => Date.now()

/** Batas daftar penerimaan (di luar render). */
const tujuhHariLalu = () => todayIso(addDays(new Date(), -7))

/** Tanggal & jam selesai bongkar; bila jam selesai lebih kecil dari jam datang, bongkar melewati tengah malam. */
function selesaiBongkar(r: ReportSummary) {
  const jam = r.jamSelesai || r.jam
  const lewat = !!r.jamSelesai && r.jam && r.jamSelesai < r.jam
  return { tanggal: lewat ? todayIso(addDays(new Date(`${r.tanggal}T00:00:00`), 1)) : r.tanggal, jam }
}

/**
 * Status uji pasca penerimaan: sudah diuji = hijau; belum diuji selama shift tempat bongkar selesai
 * masih berjalan = oranye; shift itu sudah lewat tanpa uji = merah (terlewat).
 */
function statusUji(r: ReportSummary): StatusIsi {
  if (r.sample2Jam) return 'sudah'
  const s = selesaiBongkar(r)
  const k = shiftKey(s.tanggal, s.jam || '00:00')
  const now = currentShift()
  return k && `${k.tanggal}#${k.shift}` < `${now.tanggal}#${now.shift}` ? 'terlewat' : 'belum'
}

/**
 * Operation > Kualitas Pasca Penerimaan: satu kartu per produk (penerimaan 7 hari terakhir). Lencana di kartu
 * menandai penerimaan yang belum diuji (merah = shift bongkar sudah lewat, amber = masih dalam shift); di dalam
 * kartu tampil hasil uji terakhir dan daftar penerimaan yang menunggu uji (ketuk untuk membuka form).
 */
export function Sample2Jam() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const batas = tujuhHariLalu()
  const daftar = app.reports
    .filter((r) => r.status === 'selesai' && r.tanggal >= batas)
    .sort((a, b) => (b.tanggal + (b.jamSelesai || b.jam)).localeCompare(a.tanggal + (a.jamSelesai || a.jam)))
  const adaTangki = [...new Set(app.tanks.map((t) => t.produk))]
  const produk = [...PRODUK_OPTIONS.filter((p) => adaTangki.includes(p) || daftar.some((r) => r.produk === p)), ...[...new Set(daftar.map((r) => r.produk))].filter((p) => p && !PRODUK_OPTIONS.includes(p))]
  const belumTotal = daftar.filter((r) => !r.sample2Jam).length
  const terlewatTotal = daftar.filter((r) => statusUji(r) === 'terlewat').length

  return (
    <div className="flex flex-col gap-space-md">
      <InfoHalaman judul="Kualitas Pasca Penerimaan">
        <p><b className="text-on-surface">Wajib</b> untuk setiap penerimaan BBM: setelah bongkar selesai, ambil sampel dari tangki pendam dan ukur density. Jam uji diatur petugas.</p>
        <p>Lencana merah: shift tempat bongkar selesai sudah lewat tanpa uji (terlewat). Amber: belum diuji, shift masih berjalan.</p>
      </InfoHalaman>
      <div className={cn('animate-entrance-1 flex items-center gap-space-sm rounded-xl p-space-sm', belumTotal ? (terlewatTotal ? 'bg-error-container/60' : 'bg-amber-50 ring-1 ring-amber-200') : 'bg-emerald-50 ring-1 ring-emerald-200')}>
        <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', belumTotal ? (terlewatTotal ? 'bg-error text-on-error' : 'bg-amber-400 text-amber-950') : 'bg-emerald-600 text-white')}>
          {belumTotal ? <BellRing className="size-5" /> : <CircleCheck className="size-5" />}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-body-md font-bold text-on-surface">{belumTotal ? `${belumTotal} penerimaan belum diuji` : 'Semua penerimaan sudah diuji'}</span>
          <span className="text-body-sm text-on-surface-variant">{terlewatTotal ? `${terlewatTotal} terlewat · ` : ''}7 hari terakhir · {daftar.length} penerimaan</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
        {produk.map((p, i) => (
          <KartuProdukUji key={p} produk={p} warna={warnaProduk(p, i)} daftar={daftar.filter((r) => r.produk === p)} />
        ))}
      </div>
    </div>
  )
}

function KartuProdukUji({ produk, warna, daftar }: { produk: string; warna: string; daftar: ReportSummary[] }) {
  const belum = daftar.filter((r) => !r.sample2Jam)
  const terlewat = belum.filter((r) => statusUji(r) === 'terlewat').length
  const terakhir = daftar.find((r) => r.sample2Jam)
  const u = terakhir?.sample2Jam
  return (
    <section aria-label={`${produk}: ${belum.length ? `${belum.length} belum diuji` : 'semua sudah diuji'}`} className="animate-entrance-2 relative flex flex-col gap-space-sm overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ background: warna }} />
      <div className="flex items-center gap-space-sm">
        <span aria-hidden="true" className="relative flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${warna}1f`, color: warna }}>
          <Fuel className="size-[22px]" />
          {belum.length > 0 && (
            <span className={cn('tabular absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ring-2 ring-surface-container-lowest', terlewat ? 'bg-error text-on-error' : 'bg-amber-400 text-amber-950')}>{belum.length}</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-lg font-bold text-on-surface">{produk}</span>
          <span className="text-body-sm text-on-surface-variant">{daftar.length ? `${daftar.length} penerimaan · 7 hari` : 'Tidak ada penerimaan 7 hari'}</span>
        </span>
        {belum.length ? (
          <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', terlewat ? 'bg-error-container text-on-error-container' : 'bg-amber-100 text-amber-900')}>
            {terlewat ? <TriangleAlert aria-hidden="true" className="size-3.5" /> : <Clock aria-hidden="true" className="size-3.5" />}
            {terlewat ? 'Terlewat' : 'Belum diuji'}
          </span>
        ) : daftar.length ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <CircleCheck aria-hidden="true" className="size-3.5" />
            Lengkap
          </span>
        ) : null}
      </div>
      {u && terakhir && (
        <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-sm py-space-xs text-body-sm">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
          <span className="tabular min-w-0 flex-1 text-on-surface-variant">
            Uji terakhir {formatTanggalIso(u.tanggal)} {u.jam} · <b className="text-on-surface">{formatDensity(u.d15)}</b>
            {u.selisih !== null ? ` (${formatDensitySigned(u.selisih)})` : ''}
          </span>
          {u.ok === false ? <TriangleAlert aria-label="Di luar toleransi" className="size-4 shrink-0 text-error" /> : u.ok ? <CircleCheck aria-label="Sesuai toleransi" className="size-4 shrink-0 text-emerald-600" /> : null}
        </div>
      )}
      {belum.length > 0 && (
        <ul className="flex flex-col gap-space-xs">
          {belum.map((r) => {
            const lewat = statusUji(r) === 'terlewat'
            return (
              <li key={r.id}>
                <Link
                  to={`/sample/${encodeURIComponent(r.id)}`}
                  className={cn('flex min-h-12 items-center gap-space-sm rounded-lg border px-space-sm py-space-xs active:scale-[0.99]', lewat ? 'border-error/40 bg-error-container/30' : 'border-amber-300 bg-amber-50')}
                >
                  <Truck aria-hidden="true" className={cn('size-4 shrink-0', lewat ? 'text-error' : 'text-amber-700')} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="tabular truncate text-body-sm font-semibold text-on-surface">{r.nopol || 'MT'}</span>
                    <span className="tabular text-xs text-on-surface-variant">
                      Bongkar {formatTanggalIso(r.tanggal)}, selesai {r.jamSelesai || '-'}
                    </span>
                  </span>
                  <span className={cn('flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-bold', lewat ? 'bg-error text-on-error' : 'bg-primary text-on-primary')}>
                    Uji
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Halaman form uji pasca penerimaan satu bongkaran. */
export function Sample2JamForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { id = '' } = useParams()
  const r = app.reports.find((x) => x.id === id)
  const [s, setS] = useState<Sample>(() => ({
    tanggal: todayIso(),
    jam: jamSekarang(),
    densityObs: '',
    suhu: '',
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    catatan: '',
    savedAt: '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari uji pasca penerimaan?', detail: 'Hasil uji yang belum dikirim akan hilang.' })

  if (!app.loaded) return <Loading />
  if (!r) return <GlassCard className="p-space-md">Data bongkaran tidak ditemukan.</GlassCard>

  const set = (patch: Partial<Sample>) => {
    setError(null)
    setS((x) => ({ ...x, ...patch }))
  }
  const d15 = density15(s.densityObs, s.suhu)
  const selisih = d15 && r.d15Depot !== null ? Math.round((d15.value - r.d15Depot) * 10000) / 10000 : null
  const ok = selisih !== null ? Math.abs(selisih) <= app.rules.densityTolerance + 1e-9 : null
  // Selisih terhadap Density std. 15 °C hasil bongkaran (sample MT saat bongkar), tampil langsung saat input.
  const selisihBongkar = d15 && r.d15 !== null ? Math.round((d15.value - r.d15) * 10000) / 10000 : null
  const okBongkar = selisihBongkar !== null ? Math.abs(selisihBongkar) <= app.rules.densityTolerance + 1e-9 : null

  const kirim = async () => {
    if (!s.tanggal || !s.jam) return setError('Isi tanggal dan jam uji.')
    const selesai = selesaiBongkar(r)
    if (`${s.tanggal} ${s.jam}` < `${selesai.tanggal} ${selesai.jam}`) return setError(`Jam uji harus setelah bongkar selesai (${formatTanggalIso(selesai.tanggal)} ${selesai.jam}).`)
    if (normalizeDensity(s.densityObs) === null || !s.suhu.trim()) return setError('Isi density dan suhu sampel.')
    if (!d15) return setError('Density atau suhu di luar jangkauan tabel ASTM 53.')
    if (!s.petugas.trim()) return setError('Isi nama petugas.')
    setSaving(true)
    try {
      const raw = await app.backend.getReport(r.id)
      if (!raw) throw new Error('Data bongkaran tidak ditemukan.')
      const report = normalizeReport(raw)
      const next = { ...report, updatedAt: stamp(), data: { ...report.data, sample2Jam: { ...s, savedAt: new Date(stamp()).toISOString() } } }
      const summary = summarize(next, evaluateAll(next, app.rules))
      await app.backend.saveReport(next, summary)
      app.upsertSummary(summary)
      guard.bypass()
      keTerkirim({
        judul: `Uji ${r.produk} pasca penerimaan terkirim`,
        detail: `${r.nopol || 'MT'}, bongkar ${formatTanggalIso(r.tanggal)}`,
        peringatan: ok === false ? `Selisih Density std. 15 °C di luar toleransi ${formatDensity(app.rules.densityTolerance)}.` : undefined,
        baris: [
          ['Waktu uji', `${formatTanggalIso(s.tanggal)} ${s.jam}`],
          ['Density std. 15 °C', formatDensity(d15.value)],
          ['Density std. 15 °C dokumen depot', r.d15Depot !== null ? formatDensity(r.d15Depot) : '-'],
          ['Selisih vs depot', selisih !== null ? formatDensitySigned(selisih) : '-'],
          ['Selisih vs bongkaran', selisihBongkar !== null ? formatDensitySigned(selisihBongkar) : '-'],
          ['Petugas', s.petugas.trim()],
        ],
        aksi: [
          { to: '/sample', label: 'Penerimaan lain' },
          { to: `/laporan/kualitas?baru=${encodeURIComponent(`p.${next.id}`)}`, label: 'Lihat riwayat kualitas' },
        ],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">Uji pasca penerimaan</span>
        <h2 className="text-headline-md font-bold text-on-surface">
          {r.produk}, <span className="tabular">{r.nopol || 'MT'}</span>
        </h2>
        <span className="text-body-sm text-on-surface-variant">
          Bongkar {formatTanggalIso(r.tanggal)}, selesai {r.jamSelesai || '-'}. Atur tanggal dan jam uji sesuai pelaksanaan.
        </span>
      </GlassCard>
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal uji" htmlFor="smp-tgl">
            <Input id="smp-tgl" type="date" value={s.tanggal} onChange={(e) => set({ tanggal: e.target.value })} />
          </Field>
          <Field label="Jam uji" htmlFor="smp-jam">
            <Input id="smp-jam" type="time" value={s.jam} onChange={(e) => set({ jam: e.target.value })} />
          </Field>
          <Field label="Density" htmlFor="smp-d" hint="Contoh: 0,7450 (4 desimal)">
            <Input id="smp-d" numeric inputMode="decimal" value={s.densityObs} onChange={(e) => set({ densityObs: e.target.value })} />
          </Field>
          <Field label="Suhu" htmlFor="smp-s">
            <Input id="smp-s" numeric inputMode="decimal" suffix="°C" value={s.suhu} onChange={(e) => set({ suhu: e.target.value })} />
          </Field>
        </div>
        <div aria-live="polite" className="grid grid-cols-2 gap-space-sm">
          {(
            [
              ['Selisih vs bongkaran', selisihBongkar, okBongkar, r.d15],
              ['Selisih vs depot', selisih, ok, r.d15Depot],
            ] as const
          ).map(([label, x, baik, acuan]) => (
            <div key={label} className={cn('flex flex-col rounded-md border-2 p-space-sm', baik === null ? 'border-outline-variant/60 bg-surface-container-low' : baik ? 'border-emerald-300 bg-emerald-50' : 'border-error/50 bg-error-container/60')}>
              <span className="text-xs font-bold uppercase text-on-surface-variant">{label}</span>
              <span className={cn('tabular text-headline-md font-bold', baik === false ? 'text-error' : baik ? 'text-emerald-800' : 'text-on-surface-variant')}>{x !== null ? formatDensitySigned(x) : '-'}</span>
              <span className="text-body-sm text-on-surface-variant">{acuan === null ? 'acuan belum ada' : x === null ? `acuan ${formatDensity(acuan)}, isi density & suhu` : baik ? 'Sesuai toleransi' : `Melebihi ±${formatDensity(app.rules.densityTolerance)}`}</span>
            </div>
          ))}
        </div>
        <Ladder
          rows={[
            ['Density std. 15 °C (ASTM 53)', d15 ? formatDensity(d15.value) : '-'],
            ['Density std. 15 °C dokumen depot', r.d15Depot !== null ? formatDensity(r.d15Depot) : '-'],
            ['Density std. 15 °C saat bongkar', r.d15 !== null ? formatDensity(r.d15) : '-'],
          ]}
          total={[
            'Selisih terhadap depot',
            <span key="s" className={cn(ok === false && 'text-error')}>
              {selisih !== null ? formatDensitySigned(selisih) : '-'}
              {ok !== null && (ok ? <CircleCheck aria-label="sesuai" className="ml-1 inline size-4" /> : <TriangleAlert aria-label="tidak sesuai" className="ml-1 inline size-4" />)}
            </span>,
          ]}
        />
        <Field label="Petugas" htmlFor="smp-petugas">
          <Input id="smp-petugas" value={s.petugas} onChange={(e) => set({ petugas: e.target.value })} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="smp-cat">
          <Input id="smp-cat" value={s.catatan} onChange={(e) => set({ catatan: e.target.value })} />
        </Field>
        {error && (
          <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
            <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
          </div>
        )}
        <Button size="lg" disabled={saving} onClick={kirim}>
          {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          Kirim hasil uji
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
