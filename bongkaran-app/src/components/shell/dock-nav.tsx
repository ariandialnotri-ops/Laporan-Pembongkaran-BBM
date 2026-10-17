import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-state'
import { useMenu } from './menu-data'
import { grupAktif } from './sidebar'

/**
 * Bar navigasi bawah yang statis: menempel penuh di bawah layar (di atas garis home iPhone),
 * tidak melayang, tidak bergeser, dan tanpa animasi. Berisi grup menu sesuai peran;
 * Finance (kecuali Admin/Cashier, modul utamanya) dan Profil ada di sidebar. Tombol bulat di tengah
 * adalah pintasan Lapor Insiden, Near miss & Kerusakan. Di layar lebar diganti sidebar tetap.
 */
export function DockNav() {
  const { pathname, search } = useLocation()
  const app = useApp()
  const grup = useMenu().filter((g) => g.key !== 'finance' || app.role === 'admin')
  const aktif = grupAktif(grup, pathname, search)
  const lapor = app.can('/insiden/baru')
  const tengah = Math.ceil(grup.length / 2)
  const laporAktif = pathname.startsWith('/insiden/baru')

  return (
    <nav
      aria-label="Navigasi utama"
      data-dock
      className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/50 bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] print:hidden lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch">
        {grup.map((g, i) => {
          const active = aktif === g.key && !laporAktif
          const Icon = g.icon
          const jumlah = g.items.reduce((n, i) => n + (i.badge ?? 0), 0)
          return (
            <Fragment key={g.key}>
              {lapor && i === tengah && <TombolLapor aktif={laporAktif} />}
              <Link
                to={g.href}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5', active ? 'font-semibold text-primary' : 'text-on-surface-variant')}
              >
                {active && <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-primary" />}
                <span className="relative">
                  <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
                  {jumlah > 0 && (
                    <span className="tabular absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-[#ffc9ad] px-1 text-[10px] font-bold text-[#4d1d02]" aria-label={`${jumlah} perlu dikerjakan`}>
                      {jumlah}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-[11px] tracking-normal">{g.labelPendek ?? g.label}</span>
              </Link>
            </Fragment>
          )
        })}
        {lapor && grup.length <= tengah && <TombolLapor aktif={laporAktif} />}
      </div>
    </nav>
  )
}

/** Pintasan Lapor Insiden, Near miss & Kerusakan: tombol bulat merah yang menonjol di tengah bar. */
function TombolLapor({ aktif }: { aktif: boolean }) {
  return (
    <Link to="/insiden/baru" aria-label="Lapor insiden, near miss & kerusakan" aria-current={aktif ? 'page' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5">
      <span className="absolute -top-6 flex size-14 items-center justify-center rounded-full bg-error text-on-error shadow-[0_6px_16px_rgba(186,26,26,0.35)] ring-4 ring-surface-container-lowest">
        <ShieldAlert aria-hidden="true" className="size-7" strokeWidth={2} />
      </span>
      <span className={cn('max-w-full truncate text-[11px] tracking-normal', aktif ? 'font-semibold text-error' : 'text-on-surface-variant')}>Lapor</span>
    </Link>
  )
}
