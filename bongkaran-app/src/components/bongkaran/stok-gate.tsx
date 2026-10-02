import { Link } from 'react-router-dom'
import { ArrowRight, Fuel } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { stokRecordId, type StokRecord } from '@/lib/daily'
import { currentShift, shiftLabel } from '@/lib/shift'
import { TANKS } from '@/lib/tank'
import { cn } from '@/lib/utils'

/** Stok awal shift yang sedang berjalan: wajib diisi sebelum bongkar dan uji Q&Q. */
export function useStokShift() {
  const app = useApp()
  const key = currentShift()
  const record = app.daily.find((d): d is StokRecord => d.kind === 'stok' && d.id === stokRecordId(key.tanggal, key.shift)) ?? null
  const complete = !!record && TANKS.every((t) => (record.data.items[t.produk]?.volume ?? '').trim() !== '')
  return { key, record, missing: app.loaded && !complete }
}

/** Kartu pengingat (tampil hanya bila stok awal shift ini belum lengkap). */
export function StokGate({ className, action = 'mulai bongkar' }: { className?: string; action?: string }) {
  const { key, missing } = useStokShift()
  if (!missing) return null
  return (
    <GlassCard level={3} role="alert" className={cn('flex flex-col gap-space-sm border border-error/40 p-space-md', className)}>
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-error-container text-error">
          <Fuel className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-body-md font-bold text-on-surface">Stok awal {shiftLabel(key.shift)} belum diisi</span>
          <span className="text-body-sm text-on-surface-variant">Wajib diisi untuk setiap produk sebelum {action}.</span>
        </div>
      </div>
      <Link to="/stok" className={buttonVariants({ size: 'pill', className: 'self-start' })}>
        Isi stok awal
        <ArrowRight aria-hidden="true" />
      </Link>
    </GlassCard>
  )
}
