import { Link } from 'react-router-dom'
import { ArrowRight, Cylinder, Fuel } from 'lucide-react'
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
  // Database tangki belum diisi: stok awal belum bisa dihitung, jadi belum diwajibkan.
  const tanpaTangki = TANKS.length === 0
  const complete = tanpaTangki || (!!record && TANKS.every((t) => (record.data.items[t.produk]?.volume ?? '').trim() !== ''))
  return { key, record, tanpaTangki, missing: app.loaded && !complete }
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

/**
 * Pemberitahuan SPBU yang belum mengisi database tangki: modul lain tetap jalan, tetapi stok awal
 * shift dan hitung volume dari tinggi (ATG/deepstick) menunggu tabel kalibrasi tangki.
 */
export function TangkiBelumAda({ className, detail = 'Stok awal shift dan hitung volume dari tinggi ATG/deepstick menunggu tabel kalibrasi tangki.' }: { className?: string; detail?: string }) {
  const app = useApp()
  if (!app.loaded || app.tanks.length > 0) return null
  const bisaIsi = app.can('/pengaturan/tangki')
  return (
    <GlassCard level={1} role="status" className={cn('flex flex-col gap-space-sm border border-amber-300 bg-amber-50/80 p-space-sm', className)}>
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <Cylinder className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-body-md font-bold text-on-surface">Database tangki belum diisi</span>
          <span className="text-body-sm text-on-surface-variant">
            {detail} {bisaIsi ? '' : 'Minta pengawas SPBU mengisinya.'}
          </span>
        </div>
      </div>
      {bisaIsi && (
        <Link to="/pengaturan/tangki" className={buttonVariants({ variant: 'soft', size: 'sm', className: 'self-start' })}>
          Isi database tangki
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </GlassCard>
  )
}
