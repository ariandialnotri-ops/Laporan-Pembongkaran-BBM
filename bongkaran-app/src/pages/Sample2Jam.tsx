import { useState } from 'react'
import { ChevronRight, CircleCheck, Clock, LoaderCircle, Save, TriangleAlert } from 'lucide-react'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { density15, normalizeDensity } from '@/lib/density'
import { formatDensity, formatDensitySigned } from '@/lib/format'
import { sampleMenunggu } from '@/lib/sample'
import { evaluateAll, normalizeReport, summarize, type ReportSummary, type Sample2Jam as Sample } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Jam sekarang (di luar render). */
const jamSekarang = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Draft = { r: ReportSummary; s: Sample; error: string | null }

/** Tanggal & jam selesai bongkar; bila jam selesai lebih kecil dari jam datang, bongkar melewati tengah malam. */
function selesaiBongkar(r: ReportSummary) {
  const jam = r.jamSelesai || r.jam
  const lewat = !!r.jamSelesai && r.jam && r.jamSelesai < r.jam
  return { tanggal: lewat ? todayIso(addDays(new Date(`${r.tanggal}T00:00:00`), 1)) : r.tanggal, jam }
}

/**
 * Input > Uji Kualitas Pasca Penerimaan: uji density tangki pendam setelah bongkar
 * selesai. Jam uji diatur petugas, tetapi tetap wajib untuk setiap penerimaan.
 */
export function Sample2Jam() {
  const app = useApp()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  if (!app.loaded) return <Loading />

  const menunggu = sampleMenunggu(app.reports)
  const selesai = app.reports.filter((r) => r.sample2Jam).slice(0, 8)

  const buka = (r: ReportSummary) =>
    setDraft({
      r,
      error: null,
      s: { tanggal: todayIso(), jam: jamSekarang(), densityObs: '', suhu: '', petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName, catatan: '', savedAt: '' },
    })

  const set = (patch: Partial<Sample>) => draft && setDraft({ ...draft, s: { ...draft.s, ...patch }, error: null })

  const d15 = draft ? density15(draft.s.densityObs, draft.s.suhu) : null
  const selisih = draft && d15 && draft.r.d15Depot !== null ? Math.round((d15.value - draft.r.d15Depot) * 10000) / 10000 : null
  const ok = selisih !== null ? Math.abs(selisih) <= app.rules.densityTolerance + 1e-9 : null

  const simpan = async () => {
    if (!draft) return
    const fail = (error: string) => setDraft({ ...draft, error })
    if (!draft.s.tanggal || !draft.s.jam) return fail('Isi tanggal dan jam uji.')
    const selesai = selesaiBongkar(draft.r)
    if (`${draft.s.tanggal} ${draft.s.jam}` < `${selesai.tanggal} ${selesai.jam}`) return fail(`Jam uji harus setelah bongkar selesai (${formatTanggalIso(selesai.tanggal)} ${selesai.jam}).`)
    if (normalizeDensity(draft.s.densityObs) === null || !draft.s.suhu.trim()) return fail('Isi density dan suhu sampel.')
    if (!d15) return fail('Density atau suhu di luar jangkauan tabel ASTM 53.')
    if (!draft.s.petugas.trim()) return fail('Isi nama petugas.')
    setSaving(true)
    try {
      const raw = await app.backend.getReport(draft.r.id)
      if (!raw) return fail('Data bongkaran tidak ditemukan.')
      const report = normalizeReport(raw)
      const next = { ...report, updatedAt: Date.now(), data: { ...report.data, sample2Jam: { ...draft.s, savedAt: new Date().toISOString() } } }
      const summary = summarize(next, evaluateAll(next, app.rules))
      await app.backend.saveReport(next, summary)
      app.upsertSummary(summary)
      setDraft(null)
      toast(ok === false ? 'Uji tersimpan: selisih D15 di luar toleransi' : 'Uji kualitas pasca penerimaan tersimpan', ok === false ? TriangleAlert : undefined)
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        <b className="text-on-surface">Wajib</b> untuk setiap penerimaan BBM: setelah bongkar selesai, ambil sampel dari tangki pendam dan ukur density. Jam uji diatur petugas. Hasilnya dibanding D15 dokumen depot.
      </p>

      <section aria-labelledby="sample-menunggu" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="sample-menunggu" title="Belum diuji" action={<span className="tabular text-body-sm text-on-surface-variant">{menunggu.length}</span>} />
        {menunggu.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Semua penerimaan 7 hari terakhir sudah diuji pasca penerimaan.
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40">
            {menunggu.map(({ r }) => (
              <button key={r.id} type="button" onClick={() => buka(r)} className="flex min-h-16 items-center gap-space-sm px-space-sm py-space-xs text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-surface-container-lowest/60">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
                  <Clock className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md font-semibold text-on-surface">
                    {r.produk || '-'}, <span className="tabular">{r.nopol || 'MT'}</span>
                  </span>
                  <span className="tabular truncate text-body-sm text-on-surface-variant">
                    {formatTanggalIso(r.tanggal)}, selesai bongkar {r.jamSelesai || '-'}
                  </span>
                </span>
                <Pill tone="error">Wajib diuji</Pill>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
              </button>
            ))}
          </GlassCard>
        )}
      </section>

      {selesai.length > 0 && (
        <section aria-labelledby="sample-selesai" className="animate-entrance-3 flex flex-col gap-space-xs">
          <SectionHeader id="sample-selesai" title="Sudah diuji" />
          <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
            {selesai.map((r) => (
              <div key={r.id} className="flex min-h-14 items-center gap-space-sm px-space-sm py-space-xs">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-sm font-semibold text-on-surface">
                    {r.produk}, <span className="tabular">{r.nopol}</span>
                  </span>
                  <span className="tabular text-body-sm text-on-surface-variant">
                    {formatTanggalIso(r.sample2Jam!.tanggal)} {r.sample2Jam!.jam}, D15 {formatDensity(r.sample2Jam!.d15)}
                    {r.sample2Jam!.selisih !== null ? ` (${formatDensitySigned(r.sample2Jam!.selisih)})` : ''}
                  </span>
                </span>
                {r.sample2Jam!.ok === false ? <Pill tone="error">Tidak sesuai</Pill> : <Pill tone="success">Sesuai</Pill>}
              </div>
            ))}
          </GlassCard>
        </section>
      )}

      <Sheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft ? `Uji ${draft.r.produk}, ${draft.r.nopol || 'MT'}` : 'Uji pasca penerimaan'}
        description={draft ? `Bongkar ${formatTanggalIso(draft.r.tanggal)}, selesai ${draft.r.jamSelesai || '-'}. Atur tanggal dan jam uji sesuai pelaksanaan.` : undefined}
        footer={
          <Button size="lg" className="flex-1" disabled={saving} onClick={simpan}>
            {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Simpan uji
          </Button>
        }
      >
        {draft && (
          <>
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="Tanggal uji" htmlFor="smp-tgl">
                <Input id="smp-tgl" type="date" value={draft.s.tanggal} onChange={(e) => set({ tanggal: e.target.value })} />
              </Field>
              <Field label="Jam uji" htmlFor="smp-jam">
                <Input id="smp-jam" type="time" value={draft.s.jam} onChange={(e) => set({ jam: e.target.value })} />
              </Field>
              <Field label="Density" htmlFor="smp-d">
                <Input id="smp-d" numeric inputMode="decimal" placeholder="0,7450" value={draft.s.densityObs} onChange={(e) => set({ densityObs: e.target.value })} />
              </Field>
              <Field label="Suhu" htmlFor="smp-s">
                <Input id="smp-s" numeric inputMode="decimal" suffix="°C" value={draft.s.suhu} onChange={(e) => set({ suhu: e.target.value })} />
              </Field>
            </div>
            <Ladder
              rows={[
                ['Density @15°C (ASTM 53)', d15 ? formatDensity(d15.value) : '-'],
                ['D15 dokumen depot', draft.r.d15Depot !== null ? formatDensity(draft.r.d15Depot) : '-'],
                ['D15 saat bongkar', draft.r.d15 !== null ? formatDensity(draft.r.d15) : '-'],
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
              <Input id="smp-petugas" value={draft.s.petugas} onChange={(e) => set({ petugas: e.target.value })} />
            </Field>
            <Field label="Catatan (opsional)" htmlFor="smp-cat">
              <Input id="smp-cat" value={draft.s.catatan} onChange={(e) => set({ catatan: e.target.value })} />
            </Field>
            {draft.error && (
              <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
                <span className="text-body-sm font-semibold text-on-error-container">{draft.error}</span>
              </div>
            )}
          </>
        )}
      </Sheet>
    </div>
  )
}
