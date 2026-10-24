import { Link, useParams } from 'react-router-dom'
import { KualitasHighlight } from '@/components/bongkaran/kualitas-highlight'
import { Loading } from '@/components/bongkaran/load-state'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp, useSyncOnOpen } from '@/lib/app-state'

/** Laporan > Riwayat Kualitas Harian > satu hasil uji: hanya highlight data, bukan form input. */
export function KualitasDetail() {
  const app = useApp()
  useSyncOnOpen()
  const { kunci = '' } = useParams()
  if (!app.loaded) return <Loading />
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 p-space-md">
        <KualitasHighlight kunci={kunci} />
      </GlassCard>
      <Link to="/laporan/kualitas" className={buttonVariants({ variant: 'glass', size: 'lg' })}>
        Kembali ke riwayat
      </Link>
    </div>
  )
}
