import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, ChevronRight, ClipboardList, Fuel, LoaderCircle, MapPin, Truck, TriangleAlert } from 'lucide-react'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StokGate, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { loPickable } from '@/lib/plan'
import { blankReport, evaluateAll, STEPS, summarize } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Beranda form Input: bongkaran yang masih berjalan + tombol mulai bongkaran baru. */
export function FormInput() {
  const app = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const drafts = app.reports.filter((r) => r.status === 'draft')
  const openPlans = app.plans.filter((p) => p.noSO && p.los.some((lo) => loPickable(lo, app.usedLoIds))).length
  const stok = useStokShift()

  const mulai = async () => {
    if (stok.missing) return toast('Isi stok awal shift ini terlebih dahulu', TriangleAlert)
    setBusy(true)
    try {
      const report = blankReport(app.settings, app.session.user?.id ?? null)
      const summary = summarize(report, evaluateAll(report, app.rules))
      await app.backend.saveReport(report, summary)
      app.upsertSummary(summary)
      navigate(`/input/${report.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memulai bongkaran', TriangleAlert)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-center gap-space-sm p-space-md">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
          <MapPin className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-tag uppercase text-primary">SPBU tujuan</span>
          <span className="truncate text-headline-md font-bold text-on-surface">{app.settings.namaSpbu || 'SPBU'}</span>
          <span className="truncate text-body-sm text-on-surface-variant">{app.settings.alamatSpbu || `${STEPS.length} tahap SOP pembongkaran`}</span>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md text-on-surface">
          Mulai saat mobil tangki tiba. Form memandu {STEPS.length} tahap SOP (Bongkaran, Quality, lalu Quantity) dan otomatis membuat Berita Acara.
        </span>
        <div className="flex flex-wrap gap-space-xs">
          <Pill tone={openPlans > 0 ? 'cyan' : 'error'}>
            <ClipboardList aria-hidden="true" />
            {openPlans > 0 ? `${openPlans} SO menunggu` : 'Plan Kirim kosong'}
          </Pill>
          {app.backend.mode === 'local' && <Pill>Mode lokal</Pill>}
        </div>
        <StokGate />
        <Button size="lg" className="w-full" disabled={busy || stok.missing} onClick={mulai}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Truck aria-hidden="true" />}
          Mulai bongkaran baru
          {!busy && <ArrowRight aria-hidden="true" />}
        </Button>
        {openPlans === 0 && (
          <Link to="/plan" className={cn(buttonVariants({ variant: 'glass', size: 'pill' }), 'self-center')}>
            Buka Plan Kirim
          </Link>
        )}
      </GlassCard>

      <div className="animate-entrance-3 grid grid-cols-2 gap-space-xs">
        <Link to="/qq" className="glass-2 rim-light flex min-h-20 flex-col justify-between gap-space-xs rounded-lg p-space-sm active:scale-[0.98]">
          <Beaker aria-hidden="true" className="size-5 text-primary" />
          <span className="flex flex-col">
            <span className="text-body-md font-bold text-on-surface">Q&Q Harian</span>
            <span className="text-body-sm text-on-surface-variant">Density & bejana 20 L</span>
          </span>
        </Link>
        <Link to="/stok" className="glass-2 rim-light flex min-h-20 flex-col justify-between gap-space-xs rounded-lg p-space-sm active:scale-[0.98]">
          <Fuel aria-hidden="true" className="size-5 text-primary" />
          <span className="flex flex-col">
            <span className="text-body-md font-bold text-on-surface">Stok Shift</span>
            <span className="text-body-sm text-on-surface-variant">{stok.missing ? 'Stok awal belum diisi' : 'Stok awal & pengeluaran'}</span>
          </span>
        </Link>
      </div>

      <section aria-labelledby="bongkar-berjalan" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="bongkar-berjalan" title="Bongkaran Berjalan" />
        {drafts.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Tidak ada bongkaran yang sedang berjalan.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {drafts.map((r) => (
              <Link key={r.id} to={`/input/${r.id}`}>
                <GlassCard level={1} className="transition-shadow duration-200 hover:shadow-md">
                  <div className="flex items-center gap-space-sm p-space-sm">
                    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-primary">
                      <Truck className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="tabular text-body-md font-semibold text-on-surface">{r.nopol || 'MT baru'}</span>
                        {r.densityAnomaly ? (
                          <Pill tone="error">Anomali density</Pill>
                        ) : (
                          <Pill tone="cyan">
                            Tahap {Math.min(r.doneCount + 1, STEPS.length)}/{STEPS.length}
                          </Pill>
                        )}
                      </div>
                      <span className="truncate text-body-sm text-on-surface-variant">
                        {r.produk || 'Produk belum dipilih'}, {formatTanggalIso(r.tanggal)} {r.jam}
                      </span>
                    </div>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
