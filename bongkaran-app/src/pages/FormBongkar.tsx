import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Beaker, Flag, Lock, Ruler, Trash2, Truck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import type { ExportKind } from '@/lib/report/export'
import { FinishPanel } from '@/components/bongkaran/finish-panel'
import { LoadError, Loading } from '@/components/bongkaran/load-state'
import { StepContent } from '@/components/bongkaran/sop-steps'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { clearBackup, readBackup, readStep, writeBackup, writeStep } from '@/lib/draft-backup'
import { compressImage } from '@/lib/image'
import { evaluateAll, normalizeReport, summarize, suggestNoBA, type StepState, type Photo, type Report, type ReportData, type ReportStatus, type StepId } from '@/lib/sop'
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
  const [loaded, setLoaded] = useState<{ report: Report; restored: boolean } | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    app.backend.getReport(id).then(
      (r) => {
        if (!alive) return
        if (!r) {
          clearBackup(id)
          return setLoadError(new Error('Data bongkaran tidak ditemukan'))
        }
        // Perubahan terakhir belum sempat terkirim (halaman dimuat ulang): pakai cadangan perangkat.
        const backup = app.backend.mode === 'supabase' && r.status === 'draft' ? readBackup(id) : null
        if (!backup) clearBackup(id)
        setLoaded(backup ? { report: normalizeReport(backup), restored: true } : { report: normalizeReport(r), restored: false })
      },
      (e: unknown) => alive && setLoadError(e instanceof Error ? e : new Error(String(e))),
    )
    return () => {
      alive = false
    }
  }, [app.backend, id, tick])

  if (loadError) return <LoadError error={loadError} onRetry={() => (setLoadError(null), setTick((t) => t + 1))} />
  if (!loaded) return <Loading />
  return <BongkarEditor key={loaded.report.id} initial={loaded.report} restored={loaded.restored} />
}

function BongkarEditor({ initial, restored }: { initial: Report; restored: boolean }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [report, setReport] = useState(initial)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [photoBusy, setPhotoBusy] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string[] | null>(null)

  const rules = app.rules
  const evaluation = useMemo(() => evaluateAll(report, rules), [report, rules])
  const readOnly = report.status !== 'draft'
  const firstOpen = evaluation.steps.find((s) => !s.complete)?.id
  // Kembali ke langkah terakhir yang dibuka (mis. setelah halaman dimuat ulang).
  const [view, setView] = useState<StepId | 'finish'>(() => {
    if (initial.status !== 'draft' || !firstOpen) return 'finish'
    const last = readStep(initial.id)
    return last && last !== 'finish' && evaluation.steps.some((s) => s.id === last && !s.locked) ? last : firstOpen
  })

  // ---------- Simpan otomatis: jeda 600 ms, berurutan, dan dikirim sebelum keluar halaman ----------
  const pending = useRef<Report | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const firstRender = useRef(true)
  /** Simpan tanpa jeda (setelah foto ditambah/dihapus). */
  const urgent = useRef(false)

  // save/flush harus stabil: bila ikut berubah setiap state aplikasi berubah,
  // efek autosave terpicu lagi dan menyimpan terus-menerus tanpa henti.
  const latest = useRef({ backend: app.backend, upsertSummary: app.upsertSummary, rules, toast })
  useEffect(() => {
    latest.current = { backend: app.backend, upsertSummary: app.upsertSummary, rules, toast }
  })

  const save = useCallback((r: Report) => {
    const { backend, upsertSummary, rules, toast } = latest.current
    const summary = summarize(r, evaluateAll(r, rules))
    upsertSummary(summary)
    chain.current = chain.current.then(async () => {
      try {
        await backend.saveReport(r, summary)
        if (backend.mode === 'supabase') clearBackup(r.id, r.updatedAt)
        if (!pending.current) setSaveState('saved')
      } catch (e) {
        setSaveState('error')
        toast(`Gagal menyimpan: ${pesan(e)}`, TriangleAlert)
      }
    })
    return chain.current
  }, [])
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
    if (latest.current.backend.mode === 'supabase') writeBackup(report)
    pending.current = report
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), urgent.current ? 0 : 600)
    urgent.current = false
  }, [report, flush])

  // Isian dari cadangan perangkat langsung dikirim ke server.
  useEffect(() => {
    if (restored) void save(initial)
  }, [restored, initial, save])

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

  // Foto yang baru diambil ditampilkan dari blob lokal (tanpa salinan base64).
  const objectUrls = useRef<string[]>([])
  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const setData = useCallback((patch: Partial<ReportData>) => {
    setError(null)
    setReport((prev) => ({ ...prev, updatedAt: Date.now(), data: { ...prev.data, ...patch } }))
  }, [])

  const addPhotos = async (slot: string, files: File[]) => {
    setPhotoBusy(slot)
    try {
      for (const f of files) {
        const blob = await compressImage(f)
        const photo = await app.backend.uploadPhoto(report.id, blob, f.name)
        if (!photo.dataUrl) {
          const url = URL.createObjectURL(blob)
          objectUrls.current.push(url)
          setPhotoUrls((prev) => ({ ...prev, [photo.id]: url }))
        }
        urgent.current = true
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
    urgent.current = true
    setReport((prev) => ({ ...prev, updatedAt: Date.now(), photos: { ...prev.photos, [slot]: (prev.photos[slot] ?? []).filter((_, i) => i !== index) } }))
    if (photo) void app.backend.deletePhoto(photo).catch(() => {})
  }

  // ---------- Navigasi langkah ----------
  const go = (next: StepId | 'finish') => {
    setError(null)
    setView(next)
    writeStep(report.id, next)
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
  // Laporan mengikuti template Excel referensi; modul dimuat saat dibutuhkan.
  const runExport = async (kind: ExportKind) => {
    setGenerating(kind)
    try {
      await flush()
      const ex = await import('@/lib/report/export')
      const x = evaluation.derived
      if (kind === 'xlsx') await ex.exportBaXlsx(report, x, app.settings, `${fileBase}.xlsx`)
      else if (kind === 'jpg') await ex.exportBaJpg(report, x, app.settings, `${fileBase}.jpg`)
      // PDF BA saja: tanpa memuat foto, jauh lebih cepat.
      else if (kind === 'pdf-ba') await ex.exportBaPdf(report, x, app.settings, null, `${fileBase}.pdf`)
      else await ex.exportBaPdf(report, x, app.settings, await photoData(), `${fileBase}_lampiran.pdf`)
    } catch (e) {
      toast(`Gagal membuat ${kind === 'xlsx' ? 'Excel' : kind === 'jpg' ? 'JPG' : 'PDF'}: ${pesan(e)}`, TriangleAlert)
    } finally {
      setGenerating(null)
    }
  }
  const selesaiLangkah = evaluation.steps.filter((s) => s.complete).length
  const guard = useLeaveGuard({
    active: !readOnly,
    title: 'Keluar dari form bongkaran?',
    detail: `Bongkaran ${report.data.nopol || 'MT'} belum selesai (${selesaiLangkah} dari ${evaluation.steps.length} langkah). Data tersimpan otomatis sebagai draf dan dapat dilanjutkan dari menu Input > Input Bongkaran.`,
    beforeLeave: flush,
  })
  const waText = useMemo(() => buildWaText(report, evaluation.derived, app.settings), [report, evaluation, app.settings])

  const hapus = async () => {
    if (!window.confirm('Hapus data bongkaran ini beserta semua fotonya?')) return
    if (timer.current) clearTimeout(timer.current)
    pending.current = null
    await chain.current
    try {
      await app.backend.deleteReport(report.id)
      clearBackup(report.id)
      app.removeSummary(report.id)
      toast('Data bongkaran dihapus')
      guard.bypass()
      navigate('/input/bongkar')
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
    beforePick: () => void flush(),
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
          onReopen={report.status === 'anomali' && app.canManage ? reopen : undefined}
          onPdf={() => runExport('pdf')}
          onPdfBa={() => runExport('pdf-ba')}
          onJpg={() => runExport('jpg')}
          onXlsx={() => runExport('xlsx')}
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
            <StepRail steps={evaluation.steps} view={view} onGo={go} />
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
        {readOnly ? (
          <span className="flex items-center gap-1.5 px-space-xs text-body-sm text-on-surface-variant">
            <Lock aria-hidden="true" className="size-4" />
            Bongkaran selesai, data terkunci
          </span>
        ) : (
          <Link to="/input/bongkar" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft aria-hidden="true" />
            Daftar bongkaran
          </Link>
        )}
        {app.canDeleteReport(report) && (
          <Button variant="ghost" size="sm" className="text-error" onClick={hapus}>
            <Trash2 aria-hidden="true" />
            Hapus
          </Button>
        )}
      </div>
      {guard.dialog}
    </div>
  )
}

/**
 * Semua 14 langkah dalam satu baris yang bisa digeser. Langkah aktif selalu
 * digulir ke tengah; pemisah tipis menandai batas Bongkaran, Quality, Quantity.
 */
function StepRail({ steps, view, onGo }: { steps: StepState[]; view: StepId | 'finish'; onGo: (id: StepId) => void }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="step"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [view])
  return (
    <ol ref={ref} aria-label="Langkah 1 sampai 14" className="-mx-space-md flex snap-x items-center gap-1.5 overflow-x-auto px-space-md pb-1 pt-space-2xs [scrollbar-width:none]">
      {ORDER.map((sid, i) => {
        const s = steps.find((x) => x.id === sid)!
        const n = i + 1
        const active = sid === view
        const batas = i > 0 && phaseOf(ORDER[i - 1]).id !== phaseOf(sid).id
        return (
          <li key={sid} className="flex shrink-0 snap-center items-center gap-1.5">
            {batas && <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-outline-variant" />}
            <button
              type="button"
              disabled={s.locked}
              onClick={() => onGo(sid)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Langkah ${n}: ${s.title}${s.complete ? ', lengkap' : s.locked ? ', terkunci' : ''}`}
              className={cn(
                'tabular touch-44 flex size-9 items-center justify-center rounded-full text-numeric-sm font-bold transition-colors duration-200',
                active && 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]',
                !active && s.complete && 'bg-primary-fixed text-on-primary-fixed',
                !active && !s.complete && s.anomaly && 'bg-error-container text-on-error-container',
                !active && !s.complete && !s.anomaly && 'inset-field text-on-surface-variant',
                s.locked && 'opacity-40',
              )}
            >
              {n}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
