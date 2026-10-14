import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, LoaderCircle, Truck, TriangleAlert } from 'lucide-react'
import { KartuPilih, LegendaStatus } from '@/components/bongkaran/pilih-status'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StokGate, TangkiBelumAda, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
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
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex flex-col">
          <span className="text-body-md font-bold text-on-surface">Bongkaran baru</span>
          <span className="text-body-sm text-on-surface-variant">
            {STEPS.length} tahap SOP: Bongkaran, Quality, lalu Quantity. Berita Acara dibuat otomatis di akhir.
          </span>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          <Pill tone={openPlans > 0 ? 'cyan' : 'error'}>
            <ClipboardList aria-hidden="true" />
            {openPlans > 0 ? `${openPlans} SO siap dibongkar` : 'Belum ada SO siap'}
          </Pill>
          {app.backend.mode === 'local' && <Pill>Mode lokal</Pill>}
        </div>
        <StokGate />
        <TangkiBelumAda detail="Bongkaran tetap bisa dicatat; volume dari tinggi deepstick/ATG belum dihitung otomatis sampai tabel kalibrasi tangki diisi." />
        <Button size="lg" className="w-full" disabled={busy || stok.missing} onClick={mulai}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Truck aria-hidden="true" />}
          Mulai bongkaran baru
          {!busy && <ArrowRight aria-hidden="true" />}
        </Button>
        {openPlans === 0 && (
          <Link to="/plan" className={cn(buttonVariants({ variant: 'glass', size: 'pill' }), 'self-center')}>
            Buka Plan Pengiriman
          </Link>
        )}
      </GlassCard>

      <section aria-labelledby="bongkar-berjalan" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="bongkar-berjalan" title="Bongkaran Berjalan" />
        {drafts.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Tidak ada bongkaran yang sedang berjalan.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {drafts.map((r) => {
              // Bongkaran dari hari sebelumnya yang belum diselesaikan = terlewat (merah).
              const st = r.tanggal < todayIso() ? 'terlewat' : 'belum'
              return (
                <KartuPilih
                  key={r.id}
                  to={`/input/${r.id}`}
                  status={st}
                  judul={<span className="tabular">{r.nopol || 'MT baru'}</span>}
                  sub={`${r.produk || 'Produk belum dipilih'}, ${formatTanggalIso(r.tanggal)} ${r.jam}`}
                  keterangan={
                    r.densityAnomaly
                      ? 'Anomali density'
                      : `${st === 'terlewat' ? 'Belum diselesaikan · ' : ''}Tahap ${Math.min(r.doneCount + 1, STEPS.length)}/${STEPS.length}`
                  }
                />
              )
            })}
            <LegendaStatus />
          </div>
        )}
      </section>
    </div>
  )
}
