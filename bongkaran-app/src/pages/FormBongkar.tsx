import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Beaker, CircleCheck, Flag, Ruler, Trash2, Truck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { BaPrintLayout } from '@/components/bongkaran/ba-print-layout'
import { FinishPanel } from '@/components/bongkaran/finish-panel'
import { LoadError, Loading } from '@/components/bongkaran/load-state'
import { StepContent } from '@/components/bongkaran/sop-steps'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { compressImage, downloadDataUrl } from '@/lib/image'
import { nodeToJpeg } from '@/lib/jpg'
import { generateBaPdf } from '@/lib/pdf'
import { evaluateAll, summarize, suggestNoBA, type Photo, type Report, type ReportData, type ReportStatus, type StepId } from '@/lib/sop'
import { buildWaText } from '@/lib/wa'
import { cn } from '@/lib/utils'

type Phase = 'bongkaran' | 'quality' | 'quantity'

/** 14 tahap SOP dikelompokkan ke tiga tab form PANTAS. */
const PHASES: { id: Phase; label: string; icon: LucideIcon; steps: StepId[] }[] = [
  { id: 'bongkaran', label: 'Bongkaran', icon: Truck, steps: ['mt', 'lo', 'tera', 'atg_before', 'safety', 'segel', 'dip_before', 'water', 'dip_mt'] },
  { id: 'quality', label: 'Quality', icon: Beaker, steps: ['sampel', 'density'] },
  { id: 'quantity', label: 'Quantity', icon: Ruler, steps: ['hose', 'atg_after', 'dip_after'] },
]
const ORDER: StepId[] = PHASES.flatMap((p) => p.steps)
const phaseOf = (id: StepId) => PHASES.find((p) => p.steps.includes(id))!

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function FormBongkar() {
  const { id = '' } = useParams()
  const app = useApp()
  const [report, setReport] = useState<Report | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    app.backend.getReport(id).then(
      (r) => {
        if (!alive) return
        if (r) setReport(r)
        else setLoadError(new Error('Data bongkaran tidak ditemukan'))
      },
      (e: unknown) => alive && setLoadError(e instanceof Error ? e : new Error(String(e))),
    )
    return () => {
      alive = false
    }
  }, [app.backend, id, tick])

  if (loadError) return <LoadError error={loadError} onRetry={() => (setLoadError(null), setTick((t) => t + 1))} />
  if (!report) return <Loading />
  return <BongkarEditor key={report.id} initial={report} />
}

function BongkarEditor({ initial }: { initial: Report }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [report, setReport] = useState(initial)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [photoBusy, setPhotoBusy] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState<'pdf' | 'jpg' | null>(null)
  const [printData, setPrintData] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string[] | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const rules = app.rules
  const evaluation = useMemo(() => evaluateAll(report, rules), [report, rules])
  const readOnly = report.status !== 'draft'
  const firstOpen = evaluation.steps.find((s) => !s.complete)?.id
  const [view, setView] = useState<StepId | 'finish'>(() => (initial.status !== 'draft' || !firstOpen ? 'finish' : firstOpen))

  // ---------- Simpan otomatis: jeda 600 ms, berurutan, dan dikirim sebelum keluar halaman ----------
  const pending = useRef<Report | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const firstRender = useRef(true)

  const save = useCallback(
    (r: Report) => {
      const summary = summarize(r, evaluateAll(r, rules))
      app.upsertSummary(summary)
      chain.current = chain.current.then(async () => {
        try {
          await app.backend.saveReport(r, summary)
          setSaveState('saved')
        } catch (e) {
          setSaveState('error')
          toast(`Gagal menyimpan: ${pesan(e)}`, TriangleAlert)
        }
      })
      return chain.current
    },
    [app, rules, toast],
  )
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    const p = pending.current
    pending.current = null
    return p ? save(p) : chain.current
  }, [save])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    pending.current = report
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 600)
  }, [report, flush])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  // ---------- Foto ----------
  useEffect(() => {
    if (app.backend.mode !== 'supabase') return
    const missing = Object.values(report.photos)
      .flat()
      .filter((p) => !p.dataUrl && !photoUrls[p.id])
    if (!missing.length) return
    app.backend
      .signedUrls(missing)
      .then((m) => setPhotoUrls((prev) => ({ ...prev, ...m })))
      .catch((e: unknown) => toast(`Gagal memuat foto: ${pesan(e)}`, TriangleAlert))
  }, [report.photos, photoUrls, app.backend, toast])
  const srcOf = useCallback((p: Photo) => p.dataUrl || photoUrls[p.id], [photoUrls])

  const setData = useCallback((patch: Partial<ReportData>) => {
    setError(null)
    setReport((prev) => ({ ...prev, updatedAt: Date.now(), data: { ...prev.data, ...patch } }))
  }, [])

  const addPhotos = async (slot: string, files: File[]) => {
    setPhotoBusy(slot)
    try {
      for (const f of files) {
        const photo = await app.backend.uploadPhoto(report.id, await compressImage(f), f.name)
        setReport((prev) => ({ ...prev, updatedAt: Date.now(), photos: { ...prev.photos, [slot]: [...(prev.photos[slot] ?? []), photo] } }))
      }
      setError(null)
    } catch (e) {
      toast(`Gagal mengunggah foto: ${pesan(e)}`, TriangleAlert)
    } finally {
      setPhotoBusy(null)
    }
  }
  const removePhoto = (slot: string, index: number) => {
    const photo = report.photos[slot]?.[index]
    setReport((prev) => ({ ...prev, updatedAt: Date.now(), photos: { ...prev.photos, [slot]: (prev.photos[slot] ?? []).filter((_, i) => i !== index) } }))
    if (photo) void app.backend.deletePhoto(photo).catch(() => {})
  }

  // ---------- Navigasi langkah ----------
  const go = (next: StepId | 'finish') => {
    setError(null)
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const stepState = view === 'finish' ? null : evaluation.steps.find((s) => s.id === view)!
  const index = view === 'finish' ? ORDER.length : ORDER.indexOf(view)
  const phase = view === 'finish' ? null : phaseOf(view)

  const lanjut = () => {
    if (!stepState) return
    if (evaluation.densityAnomaly && stepState.id === 'density') return go('finish')
    if (!stepState.complete) return setError(stepState.issues)
    void flush()
    const next = ORDER[index + 1]
    const pindahTab = next && phaseOf(next).id !== phase!.id
    toast(pindahTab ? `Data ${phase!.label.toLowerCase()} tersimpan` : 'Tersimpan')
    go(next ?? 'finish')
  }
  const kembali = () => go(index > 0 ? ORDER[index - 1] : ORDER[0])

  const phaseUnlocked = (p: (typeof PHASES)[number]) => !evaluation.steps.find((s) => s.id === p.steps[0])!.locked
  /** Tab membuka langkah pertama yang belum lengkap di bagian itu. */
  const pilihTab = (value: string) => {
    const p = PHASES.find((x) => x.id === value)
    if (!p) return go('finish')
    go(p.steps.find((sid) => !evaluation.steps.find((x) => x.id === sid)!.complete) ?? p.steps[0])
  }

  // ---------- Selesai & output ----------
  const finish = (status: ReportStatus) => {
    setReport((prev) => ({
      ...prev,
      status,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
      data: { ...prev.data, noBA: prev.data.noBA || suggestNoBA(app.settings, prev) },
    }))
    toast(status === 'anomali' ? 'Ditutup sebagai anomali' : 'Bongkaran selesai · Berita Acara siap')
  }
  const reopen = () => {
    if (!window.confirm('Buka kembali untuk koreksi? Status kembali menjadi draft.')) return
    setReport((prev) => ({ ...prev, status: 'draft', finishedAt: null, updatedAt: Date.now() }))
  }
  const fileBase = `BA_Pembongkaran_${(report.data.nopol || 'MT').replace(/[^a-zA-Z0-9]/g, '')}_${report.data.tanggalDatang}`
  const photoData = async () => {
    const out: Record<string, string> = {}
    for (const p of Object.values(report.photos).flat()) out[p.id] = await app.backend.photoDataUrl(p)
    return out
  }
  const downloadPdf = async () => {
    setGenerating('pdf')
    try {
      generateBaPdf({ report, derived: evaluation.derived, settings: app.settings, rules, photoData: await photoData() }).save(`${fileBase}.pdf`)
    } catch (e) {
      toast(`Gagal membuat PDF: ${pesan(e)}`, TriangleAlert)
    } finally {
      setGenerating(null)
    }
  }
  const downloadJpg = async () => {
    setGenerating('jpg')
    try {
      setPrintData(await photoData())
      await new Promise((r) => setTimeout(r, 80))
      if (!printRef.current) throw new Error('layout belum siap')
      downloadDataUrl(await nodeToJpeg(printRef.current), `${fileBase}.jpg`)
    } catch (e) {
      toast(`Gagal membuat JPG: ${pesan(e)}`, TriangleAlert)
    } finally {
      setPrintData(null)
      setGenerating(null)
    }
  }
  const waText = useMemo(() => buildWaText(report, evaluation.derived, app.settings), [report, evaluation, app.settings])

  const hapus = async () => {
    if (!window.confirm('Hapus data bongkaran ini beserta semua fotonya?')) return
    if (timer.current) clearTimeout(timer.current)
    pending.current = null
    await chain.current
    try {
      await app.backend.deleteReport(report.id)
      app.removeSummary(report.id)
      toast('Data bongkaran dihapus')
      navigate('/input')
    } catch (e) {
      toast(pesan(e), TriangleAlert)
    }
  }

  const stepProps = {
    report,
    evaluation,
    settings: app.settings,
    rules,
    plans: app.plans,
    usedLoIds: app.usedLoIds,
    readOnly,
    setData,
    addPhotos,
    removePhoto,
    photoBusy,
    srcOf,
  }

  const tabValue = phase?.id ?? 'selesai'
  const tabIndex = phase ? PHASES.indexOf(phase) : 3

  return (
    <div className="flex flex-col gap-space-md">
      <Tabs value={tabValue} onValueChange={pilihTab}>
        <TabsList count={4} index={tabIndex} aria-label="Bagian formulir" className="animate-entrance-1">
          {PHASES.map((p) => {
            const Icon = p.icon
            return (
              <TabsTrigger key={p.id} value={p.id} disabled={!phaseUnlocked(p)} aria-label={p.label}>
                <Icon aria-hidden="true" />
                <span className="hidden min-[400px]:inline">{p.label}</span>
              </TabsTrigger>
            )
          })}
          <TabsTrigger value="selesai" disabled={!evaluation.allComplete && !evaluation.densityAnomaly && !readOnly} aria-label="Finish">
            <Flag aria-hidden="true" />
            <span className="hidden min-[400px]:inline">Finish</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-center gap-space-xs">
        <Pill tone={saveState === 'error' ? 'error' : 'cyan'}>
          {saveState === 'saving' ? 'Menyimpan…' : saveState === 'error' ? 'Gagal tersimpan' : 'Draf tersimpan'} · {report.data.nopol || 'MT baru'}
        </Pill>
        {app.backend.mode === 'local' && <Pill>Mode lokal</Pill>}
      </div>

      {view === 'finish' ? (
        <FinishPanel
          report={report}
          evaluation={evaluation}
          settings={app.settings}
          readOnly={readOnly}
          setData={setData}
          onFinish={finish}
          onReopen={reopen}
          onPdf={downloadPdf}
          onJpg={downloadJpg}
          generating={generating}
          waText={waText}
        />
      ) : (
        <>
          <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tag uppercase text-primary">
                Langkah {index + 1} dari {ORDER.length}
              </span>
              {stepState!.anomaly ? <Pill tone="error">Anomali</Pill> : stepState!.complete ? <Pill tone="primary">Lengkap</Pill> : null}
            </div>
            <span className="text-headline-md font-bold text-on-surface">{stepState!.title}</span>
            <span className="text-body-sm text-on-surface-variant">{stepState!.desc}</span>
            <ol aria-label={`Langkah ${phase!.label}`} className="flex flex-wrap gap-1.5 pt-space-2xs">
              {phase!.steps.map((sid) => {
                const s = evaluation.steps.find((x) => x.id === sid)!
                const n = ORDER.indexOf(sid) + 1
                const active = sid === view
                return (
                  <li key={sid}>
                    <button
                      type="button"
                      disabled={s.locked}
                      onClick={() => go(sid)}
                      aria-current={active ? 'step' : undefined}
                      aria-label={`Langkah ${n}: ${s.title}${s.complete ? ', lengkap' : ''}`}
                      className={cn(
                        'tabular touch-44 flex size-8 items-center justify-center rounded-full text-numeric-sm font-bold transition-all duration-200',
                        active && 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]',
                        !active && s.complete && 'bg-primary-fixed text-on-primary-fixed',
                        !active && !s.complete && s.anomaly && 'bg-error-container text-on-error-container',
                        !active && !s.complete && !s.anomaly && 'inset-field text-on-surface-variant',
                        s.locked && 'opacity-40',
                      )}
                    >
                      {s.complete && !active ? <CircleCheck aria-hidden="true" className="size-4" /> : n}
                    </button>
                  </li>
                )
              })}
            </ol>
          </GlassCard>

          <div className="animate-entrance-3 flex flex-col gap-space-md">
            {stepState!.locked ? (
              <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
                {evaluation.densityAnomaly ? 'Pembongkaran dihentikan karena anomali density.' : 'Selesaikan langkah sebelumnya terlebih dahulu.'}
              </GlassCard>
            ) : (
              <StepContent step={stepState!} {...stepProps} />
            )}
          </div>

          {error && (
            <GlassCard level={1} role="alert" className="flex items-start gap-space-sm bg-error-container/70 p-space-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
              <div className="flex flex-col gap-0.5 text-body-sm font-semibold text-on-error-container">
                {error.slice(0, 4).map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </GlassCard>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-space-xs">
            <Button variant="glass" size="lg" aria-label="Langkah sebelumnya" disabled={index === 0} onClick={kembali}>
              <ArrowLeft aria-hidden="true" />
            </Button>
            {readOnly ? (
              <Button size="lg" onClick={() => go(ORDER[index + 1] ?? 'finish')}>
                Berikutnya
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : evaluation.densityAnomaly && stepState!.id === 'density' ? (
              <Button size="lg" variant="danger" onClick={lanjut}>
                <TriangleAlert aria-hidden="true" />
                Hentikan & buat BA anomali
              </Button>
            ) : (
              <Button size="lg" onClick={lanjut}>
                {ORDER[index + 1] ? (phaseOf(ORDER[index + 1]).id !== phase!.id ? `Simpan & lanjut ke ${phaseOf(ORDER[index + 1]).label}` : 'Simpan & lanjut') : 'Simpan & selesaikan'}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 px-space-xs">
        <Link to="/input" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden="true" />
          Daftar bongkaran
        </Link>
        {app.canDeleteReport(report) && (
          <Button variant="ghost" size="sm" className="text-error" onClick={hapus}>
            <Trash2 aria-hidden="true" />
            Hapus
          </Button>
        )}
      </div>

      {printData && (
        <div aria-hidden="true" className="pointer-events-none fixed left-[-99999px] top-0 -z-10">
          <BaPrintLayout ref={printRef} report={report} derived={evaluation.derived} settings={app.settings} rules={rules} photoData={printData} />
        </div>
      )}
    </div>
  )
}
