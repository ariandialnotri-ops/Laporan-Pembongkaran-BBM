import { Link } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { ProteksiSettings } from '@/components/bongkaran/proteksi-settings'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'

/** APAR & APAB > Data utama: pulau pompa, area, dan unit (hanya pengawas yang dapat mengubah). */
export function DataUtamaApar() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const readOnly = !app.canManage
  return (
    <div className="flex flex-col gap-space-md">
      {readOnly && (
        <GlassCard level={1} className="animate-entrance-1 p-space-md text-center text-body-sm text-on-surface-variant">
          Data utama hanya dapat diubah oleh pengawas.
        </GlassCard>
      )}
      <fieldset disabled={readOnly} className="min-w-0">
        <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
          <ProteksiSettings />
        </GlassCard>
      </fieldset>
      <Link to="/apar/label" className={buttonVariants({ variant: 'glass', size: 'lg' })}>
        <QrCode aria-hidden="true" />
        Cetak label QR semua unit
      </Link>
    </div>
  )
}
