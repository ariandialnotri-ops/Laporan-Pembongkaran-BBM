import { useParams } from 'react-router-dom'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { UbahLoIsi } from '@/components/bongkaran/sop-steps'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { formatLiter } from '@/lib/format'
import { useKeTerkirim } from '@/lib/terkirim'

/**
 * Input Bongkaran > Ubah nomor LO (halaman tersendiri): mis. MT dialihkan ke station lain dan LO terbit
 * ulang. Disimpan ke Plan sehingga Tracking LO dan laporan ikut berubah; LO lama tetap tercatat.
 */
export function UbahLo() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { id = '', planId = '', loId = '' } = useParams()
  const plan = app.plans.find((p) => p.id === planId)
  const lo = plan?.los.find((x) => x.id === loId)
  const kembali = `/input/${encodeURIComponent(id)}`
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari ubah nomor LO?', detail: 'Nomor LO baru yang belum disimpan akan hilang.', izinkan: (p) => p === kembali })
  if (!app.loaded) return <Loading />
  if (!plan || !lo) return <GlassCard className="p-space-md">LO tidak ditemukan.</GlassCard>
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">Ubah nomor LO</span>
        <span className="text-headline-md font-bold text-on-surface">
          {lo.produk}, {formatLiter(lo.volume)}
        </span>
        <span className="text-body-sm text-on-surface-variant">SO {plan.noSO || '-'}</span>
      </GlassCard>
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <UbahLoIsi
          plan={plan}
          lo={lo}
          onClose={(hasil) => {
            guard.bypass()
            if (!hasil) return void history.back()
            keTerkirim({
              judul: hasil.pindah ? 'Pindah station terkirim' : 'Nomor LO terkirim',
              detail: `${lo.produk}, ${formatLiter(lo.volume)}, SO ${plan.noSO || '-'}`,
              baris: [
                ['LO lama', lo.noLO || 'belum terbit'],
                ['LO baru', hasil.baru],
                ...(hasil.pindah ? ([['Station baru', hasil.sp]] as [string, string][]) : []),
              ],
              aksi: [{ to: kembali, label: 'Lanjutkan form bongkaran' }],
            })
          }}
        />
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
