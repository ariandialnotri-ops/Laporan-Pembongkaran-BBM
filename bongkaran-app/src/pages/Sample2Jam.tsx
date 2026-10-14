import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CircleCheck, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { KartuPilih, LegendaStatus } from '@/components/bongkaran/pilih-status'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { density15, normalizeDensity } from '@/lib/density'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { currentShift, shiftKey } from '@/lib/shift'
import type { StatusIsi } from '@/lib/status-isi'
import { useKeTerkirim } from '@/lib/terkirim'
import { evaluateAll, normalizeReport, summarize, type ReportSummary, type Sample2Jam as Sample } from '@/lib/sop'
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
 * Operation > Kualitas Pasca Penerimaan: daftar penerimaan 7 hari terakhir (hijau sudah diuji,
 * oranye belum, merah terlewat). Ketuk untuk membuka halaman form uji.
 */
export function Sample2Jam() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const batas = tujuhHariLalu()
  const daftar = app.reports
    .filter((r) => r.status === 'selesai' && r.tanggal >= batas)
    .sort((a, b) => (b.tanggal + (b.jamSelesai || b.jam)).localeCompare(a.tanggal + (a.jamSelesai || a.jam)))
  const belum = daftar.filter((r) => !r.sample2Jam)
  const sudah = daftar.filter((r) => r.sample2Jam)
  const kartu = (r: ReportSummary) => {
    const st = statusUji(r)
    const u = r.sample2Jam
    return (
      <KartuPilih
        key={r.id}
        to={`/sample/${encodeURIComponent(r.id)}`}
        status={st}
        judul={
          <>
            {r.produk || '-'}, <span className="tabular">{r.nopol || 'MT'}</span>
          </>
        }
        sub={`${formatTanggalIso(r.tanggal)}, selesai bongkar ${r.jamSelesai || '-'}`}
        keterangan={
          u
            ? `Diuji ${formatTanggalIso(u.tanggal)} ${u.jam} · D15 ${formatDensity(u.d15)}${u.selisih !== null ? ` (${formatDensitySigned(u.selisih)})` : ''}${u.ok === false ? ' · tidak sesuai' : ''}`
            : st === 'terlewat'
              ? 'Terlewat, segera uji'
              : 'Belum diuji'
        }
      />
    )
  }
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        <b className="text-on-surface">Wajib</b> untuk setiap penerimaan BBM: setelah bongkar selesai, ambil sampel dari tangki pendam dan ukur density. Jam uji diatur petugas.
      </p>
      <section aria-labelledby="sample-belum" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="sample-belum" title="Belum diuji" action={<span className="tabular text-body-sm text-on-surface-variant">{belum.length}</span>} />
        {belum.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Semua penerimaan 7 hari terakhir sudah diuji.
          </GlassCard>
        ) : (
          belum.map(kartu)
        )}
      </section>
      {sudah.length > 0 && (
        <section aria-labelledby="sample-sudah" className="animate-entrance-3 flex flex-col gap-space-xs">
          <SectionHeader id="sample-sudah" title="Sudah diuji" />
          {sudah.slice(0, 10).map(kartu)}
        </section>
      )}
      <LegendaStatus />
    </div>
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
        peringatan: ok === false ? `Selisih D15 di luar toleransi ${formatDensity(app.rules.densityTolerance)}.` : undefined,
        baris: [
          ['Waktu uji', `${formatTanggalIso(s.tanggal)} ${s.jam}`],
          ['Density @15°C', formatDensity(d15.value)],
          ['D15 dokumen depot', r.d15Depot !== null ? formatDensity(r.d15Depot) : '-'],
          ['Selisih', selisih !== null ? formatDensitySigned(selisih) : '-'],
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
          <Field label="Density" htmlFor="smp-d">
            <Input id="smp-d" numeric inputMode="decimal" placeholder="0,7450" value={s.densityObs} onChange={(e) => set({ densityObs: e.target.value })} />
          </Field>
          <Field label="Suhu" htmlFor="smp-s">
            <Input id="smp-s" numeric inputMode="decimal" suffix="°C" value={s.suhu} onChange={(e) => set({ suhu: e.target.value })} />
          </Field>
        </div>
        <Ladder
          rows={[
            ['Density @15°C (ASTM 53)', d15 ? formatDensity(d15.value) : '-'],
            ['D15 dokumen depot', r.d15Depot !== null ? formatDensity(r.d15Depot) : '-'],
            ['D15 saat bongkar', r.d15 !== null ? formatDensity(r.d15) : '-'],
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
