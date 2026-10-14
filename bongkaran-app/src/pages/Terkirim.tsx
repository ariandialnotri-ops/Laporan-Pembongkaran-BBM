import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, CircleCheck, House, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { berandaPeran } from '@/lib/roles'
import type { InfoTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

/** Halaman setelah form dikirim: konfirmasi, ringkasan data, dan tombol kembali ke Dashboard. */
export function Terkirim() {
  const app = useApp()
  const info = (useLocation().state as InfoTerkirim | null) ?? { judul: 'Data sudah terkirim' }
  const beranda = app.can('/') ? '/' : berandaPeran(app.role)
  const Ikon = info.peringatan ? TriangleAlert : CircleCheck
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-space-md pt-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col items-center gap-space-sm p-space-lg text-center">
        <span
          aria-hidden="true"
          className={cn('flex size-20 items-center justify-center rounded-full', info.peringatan ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}
        >
          <Ikon className="size-10" strokeWidth={1.8} />
        </span>
        <span className="text-tag uppercase text-on-surface-variant">Data sudah terkirim</span>
        <h2 className="text-headline-md font-bold text-on-surface">{info.judul}</h2>
        {info.detail && <p className="text-body-md text-on-surface-variant">{info.detail}</p>}
        {info.peringatan && <p className="rounded-md bg-amber-50 px-space-sm py-space-xs text-body-sm font-semibold text-amber-800">{info.peringatan}</p>}
        {!!info.baris?.length && (
          <dl className="mt-space-xs flex w-full flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-low/70 px-space-sm text-left">
            {info.baris.map(([l, v]) => (
              <div key={l} className="flex items-baseline justify-between gap-space-sm py-2">
                <dt className="text-body-sm text-on-surface-variant">{l}</dt>
                <dd className="tabular text-right text-body-sm font-semibold text-on-surface">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </GlassCard>

      <Link to={beranda} className={cn(buttonVariants({ size: 'lg' }), 'animate-entrance-2 w-full')}>
        <House aria-hidden="true" />
        Kembali ke {beranda === '/' ? 'Dashboard' : 'menu'}
      </Link>
      {!!info.aksi?.length && (
        <div className="animate-entrance-3 flex flex-col gap-space-xs">
          {info.aksi.filter((a) => app.can(a.to.split('?')[0])).map((a) => (
            <Link key={a.to + a.label} to={a.to} className={cn(buttonVariants({ variant: 'glass', size: 'lg' }), 'w-full justify-between')}>
              {a.label}
              <ChevronRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
