import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HandCoins, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-state'
import { useMenu } from './menu-data'
import { grupAktif } from './sidebar'

/**
 * Bar navigasi bawah yang statis: menempel penuh di bawah layar (di atas garis home iPhone),
 * tidak melayang, tidak bergeser, dan tanpa animasi. Berisi grup menu sesuai peran;
 * Finance (kecuali Admin/Cashier, modul utamanya), Report, dan Profil ada di sidebar. Urutan:
 * Dashboard, Operation, [tombol bulat biru pintasan Lapor Kejadian], Delivery, HSSE. Di layar lebar diganti sidebar tetap.
 */
export function DockNav() {
  const { pathname, search } = useLocation()
  const app = useApp()
  // Finance di bar bawah: Admin/Cashier (modul utamanya) dan Cleaning Service (Keuangan = pengajuan anggaran,
  // paling kanan agar bar seimbang di kedua sisi tombol Lapor).
  const financeCs = app.role === 'cs'
  const grup = useMenu()
    .filter((g) => g.key !== 'report' && (g.key !== 'finance' || app.role === 'admin' || financeCs))
    .map((g) => (g.key === 'finance' && financeCs ? { ...g, label: 'Keuangan', labelPendek: 'Keuangan', icon: HandCoins } : g))
    .sort((a, b) => (financeCs ? Number(a.key === 'finance') - Number(b.key === 'finance') : 0))
  const aktif = grupAktif(grup, pathname, search)
  const lapor = app.can('/lapor')
  // Lapor selalu tepat di tengah layar: grup dibagi dua sisi yang lebarnya sama.
  const tengah = lapor ? Math.ceil(grup.length / 2) : grup.length
  const sisi = [grup.slice(0, tengah), grup.slice(tengah)]
  const laporAktif = pathname === '/lapor' || pathname.startsWith('/insiden/baru')
  // Layar kamera Lapor penuh tanpa bar bawah (tombol rana & Lanjut tidak tertutup).
  if (pathname === '/lapor') return null

  return (
    <nav
      aria-label="Navigasi utama"
      data-dock
      className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/50 bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] print:hidden lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch">
        {sisi.map((daftar, k) => (
          <Fragment key={k}>
            {k === 1 && lapor && <TombolLapor aktif={laporAktif} />}
            {(lapor || daftar.length > 0) && (
              <div className="flex min-w-0 flex-1 items-stretch">
                {daftar.map((g) => {
                  const active = aktif === g.key && !laporAktif
                  const Icon = g.icon
                  const jumlah = g.items.reduce((n, i) => n + (i.badge ?? 0), 0)
                  return (
                    <Link
                      key={g.key}
                      to={g.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn('relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5', active ? 'font-semibold text-primary' : 'text-on-surface-variant')}
                    >
                      {active && <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-primary" />}
                      <span className="relative">
                        <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
                        {jumlah > 0 && (
                          <span className="tabular absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-[#ffc9ad] px-1 text-xs font-bold text-[#4d1d02]" aria-label={`${jumlah} perlu dikerjakan`}>
                            {jumlah}
                          </span>
                        )}
                      </span>
                      <span className="max-w-full truncate text-xs tracking-normal">{g.labelPendek ?? g.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}

/**
 * Pintasan Lapor Kejadian (insiden, near miss, temuan, kerusakan): tombol bulat biru (ikon pindai) yang menonjol di tengah bar;
 * membuka kamera (foto/video bercap waktu), lalu pilih jenis laporan.
 * Susunan sama dengan item lain (ruang ikon + label) supaya label sejajar.
 */
function TombolLapor({ aktif }: { aktif: boolean }) {
  return (
    <Link to="/lapor" aria-label="Lapor kejadian: insiden, near miss, temuan & kerusakan" aria-current={aktif ? 'page' : undefined} className="relative flex w-[20%] shrink-0 flex-col items-center justify-center gap-0.5">
      <span aria-hidden="true" className="absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,80,203,0.35)] ring-4 ring-surface-container-lowest">
        <ScanLine className="size-7" strokeWidth={2} />
      </span>
      <span aria-hidden="true" className="size-[22px]" />
      <span className={cn('max-w-full truncate text-xs tracking-normal', aktif ? 'font-semibold text-primary' : 'text-on-surface-variant')}>Lapor</span>
    </Link>
  )
}
