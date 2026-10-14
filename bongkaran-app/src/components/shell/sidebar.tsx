import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, Settings, UserRound, X } from 'lucide-react'
import { useApp } from '@/lib/app-state'
import { APP_NAME, TAGLINE } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { useMenu, type GrupMenu, type ItemMenu } from './menu-data'

/** Grup yang memuat halaman ini (untuk dibuka otomatis & disorot). */
export function grupAktif(grup: GrupMenu[], pathname: string, search: string) {
  const cocok = (to: string) => {
    const [p, q] = to.split('?')
    return (pathname === p || (p !== '/' && pathname.startsWith(`${p}/`))) && (!q || search.includes(q))
  }
  return grup.find((g) => g.href === pathname || g.items.some((i) => cocok(i.to)))?.key ?? null
}

/** Badge angka seperti referensi: oranye = perlu dikerjakan, hijau = sedang berjalan. */
function Badge({ n, tone }: { n: number; tone: 'warn' | 'info' }) {
  return (
    <span
      className={cn(
        'tabular flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-body-sm font-semibold',
        tone === 'warn' ? 'bg-[#ffc9ad] text-[#4d1d02]' : 'bg-[#c2ebd1] text-[#0b3a21]',
      )}
    >
      {n}
    </span>
  )
}

function ItemAnak({ item, aktif, terakhir, onNavigate }: { item: ItemMenu; aktif: boolean; terakhir: boolean; onNavigate?: () => void }) {
  return (
    <li className="relative pl-5">
      {/* Garis cabang: vertikal ke item berikutnya + lengkung ke item ini. */}
      {!terakhir && <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 border-l border-outline-variant/70" />}
      <span aria-hidden="true" className="absolute left-0 top-0 h-1/2 w-3.5 rounded-bl-[10px] border-b border-l border-outline-variant/70" />
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={aktif ? 'page' : undefined}
        className={cn(
          'flex min-h-11 items-center gap-2 rounded-[14px] px-3 py-2 text-body-md',
          aktif ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-[0_4px_14px_rgba(15,23,42,0.08)]' : 'text-on-surface-variant hover:text-on-surface',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {!!item.badge && <Badge n={item.badge} tone="warn" />}
        {!item.badge && !!item.info && <Badge n={item.info} tone="info" />}
      </Link>
    </li>
  )
}

/** Isi sidebar (dipakai sidebar tetap di layar lebar dan laci di HP). */
export function SidebarIsi({ onNavigate }: { onNavigate?: () => void }) {
  const app = useApp()
  const { pathname, search } = useLocation()
  const grup = useMenu()
  const aktifKey = grupAktif(grup, pathname, search)
  // Grup yang dibuka pengguna; grup halaman aktif selalu terbuka saat berpindah halaman.
  const [buka, setBuka] = useState<Record<string, boolean>>({})
  const terbuka = (key: string) => buka[key] ?? key === aktifKey

  const anakAktif = (g: GrupMenu) => {
    // Item paling spesifik yang cocok dengan halaman ini.
    const cocok = g.items.filter((i) => {
      const [p, q] = i.to.split('?')
      return (pathname === p || pathname.startsWith(`${p}/`)) && (!q || search.includes(q))
    })
    return cocok.sort((a, b) => b.to.length - a.to.length)[0]?.to
  }

  return (
    <div className="flex h-full flex-col gap-space-md overflow-y-auto px-space-md pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-space-sm px-1" aria-label={`${APP_NAME}, buka Dashboard`}>
        <img src="/floq-icon.webp" alt="" width={128} height={128} className="size-12 rounded-[14px] shadow-[0_8px_18px_rgba(15,23,42,0.18)]" />
        <span className="flex min-w-0 flex-col">
          <span className="text-headline-md font-bold tracking-tight text-on-surface">{APP_NAME}</span>
          <span className="truncate text-[11px] leading-tight text-on-surface-variant">{TAGLINE}</span>
        </span>
      </Link>

      <nav aria-label="Menu samping" className="flex flex-col gap-1">
        {grup.map((g) => {
          const Icon = g.icon
          const punyaAnak = g.items.length > 0
          const open = punyaAnak && terbuka(g.key)
          const jumlah = g.items.reduce((n, i) => n + (i.badge ?? 0), 0)
          const kelasBaris = 'flex min-h-12 w-full items-center gap-space-sm rounded-[14px] px-2 text-left text-body-md'
          if (!punyaAnak)
            return (
              <Link
                key={g.key}
                to={g.href}
                onClick={onNavigate}
                aria-current={pathname === g.href ? 'page' : undefined}
                className={cn(kelasBaris, pathname === g.href ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-[0_4px_14px_rgba(15,23,42,0.08)]' : 'text-on-surface hover:bg-surface-container-lowest/60')}
              >
                <Icon aria-hidden="true" className="size-[22px] shrink-0 text-on-surface-variant" strokeWidth={1.6} />
                <span className="flex-1">{g.label}</span>
                {g.segera && <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[11px] font-semibold uppercase text-on-surface-variant">Segera</span>}
              </Link>
            )
          const ikhtisar: ItemMenu = { to: g.href, path: g.href, icon: g.icon, title: 'Ikhtisar', desc: '', status: '' }
          const anak = [ikhtisar, ...g.items]
          const aktifTo = pathname === g.href ? g.href : anakAktif(g)
          return (
            <div key={g.key} className="flex flex-col">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setBuka((b) => ({ ...b, [g.key]: !open }))}
                className={cn(kelasBaris, 'hover:bg-surface-container-lowest/60', aktifKey === g.key ? 'font-semibold text-on-surface' : 'text-on-surface')}
              >
                <Icon aria-hidden="true" className={cn('size-[22px] shrink-0', aktifKey === g.key ? 'text-on-surface' : 'text-on-surface-variant')} strokeWidth={1.6} />
                <span className="flex-1">{g.label}</span>
                {!open && jumlah > 0 && <Badge n={jumlah} tone="warn" />}
                <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-on-surface-variant transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <ul className="ml-[18px] mt-1 flex flex-col gap-0.5 pb-1">
                  {anak.map((i, k) => (
                    <ItemAnak key={i.to} item={i} aktif={aktifTo === i.to} terakhir={k === anak.length - 1} onNavigate={onNavigate} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant/50 pt-space-sm">
        {app.can('/pengaturan') && (
          <Link to="/pengaturan" onClick={onNavigate} className="flex min-h-11 items-center gap-space-sm rounded-[14px] px-2 text-body-md text-on-surface-variant hover:text-on-surface">
            <Settings aria-hidden="true" className="size-5" strokeWidth={1.6} />
            Pengaturan SPBU
          </Link>
        )}
        <Link
          to="/profil"
          onClick={onNavigate}
          aria-current={pathname === '/profil' ? 'page' : undefined}
          className={cn('flex min-h-12 items-center gap-space-sm rounded-[14px] px-2', pathname === '/profil' && 'bg-surface-container-lowest shadow-[0_4px_14px_rgba(15,23,42,0.08)]')}
        >
          <span aria-hidden="true" className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-body-sm font-bold text-on-primary-fixed">
            {app.initials || <UserRound className="size-4" />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-md font-semibold text-on-surface">{app.displayName}</span>
            <span className="text-body-sm text-on-surface-variant">Profil & akun</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

/** Sidebar tetap di layar lebar (lg ke atas); dapat disembunyikan (bergeser ke kiri). */
export function SidebarTetap({ tertutup }: { tertutup: boolean }) {
  return (
    <aside
      aria-hidden={tertutup || undefined}
      inert={tertutup || undefined}
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-outline-variant/40 bg-[#f1f2f4] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] print:hidden lg:block motion-reduce:transition-none',
        tertutup && '-translate-x-full',
      )}
    >
      <SidebarIsi />
    </aside>
  )
}

/**
 * Laci sidebar di HP/tablet: dibuka dari tombol menu di header atau digeser dari tepi kiri layar,
 * ditutup dengan menggeser ke kiri, mengetuk latar, atau tombol tutup. Laci mengikuti jari saat digeser.
 */
export function SidebarLaci({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [geser, setGeser] = useState(0)
  const awal = useRef<{ x: number; y: number; arah: 'h' | 'v' | null } | null>(null)
  const mulai = (e: React.TouchEvent) => {
    const t = e.touches[0]
    awal.current = { x: t.clientX, y: t.clientY, arah: null }
  }
  const gerak = (e: React.TouchEvent) => {
    const a = awal.current
    if (!a) return
    const t = e.touches[0]
    const dx = t.clientX - a.x
    const dy = t.clientY - a.y
    // Kunci arah setelah 8 px: geser vertikal = gulir daftar menu, bukan menutup laci.
    if (!a.arah && Math.abs(dx) + Math.abs(dy) > 8) a.arah = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    if (a.arah === 'h') setGeser(Math.min(0, dx))
  }
  const lepas = () => {
    const tutup = geser < -70
    awal.current = null
    setGeser(0)
    if (tutup) onOpenChange(false)
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-on-surface/30" style={geser ? { opacity: Math.max(0.2, 1 + geser / 320) } : undefined} />
        <Dialog.Content
          onTouchStart={mulai}
          onTouchMove={gerak}
          onTouchEnd={lepas}
          onTouchCancel={lepas}
          style={geser ? { transform: `translateX(${geser}px)`, transition: 'none' } : undefined}
          className="laci-sidebar fixed inset-y-0 left-0 z-[61] w-[86vw] max-w-80 rounded-r-[28px] bg-[#f1f2f4] shadow-2xl transition-transform duration-200 focus:outline-none"
        >
          <Dialog.Title className="sr-only">Menu {APP_NAME}</Dialog.Title>
          <Dialog.Description className="sr-only">Semua fitur dikelompokkan per peruntukan. Geser ke kiri untuk menutup.</Dialog.Description>
          <Dialog.Close className="absolute right-3 top-[calc(1rem+env(safe-area-inset-top,0px))] z-10 flex size-11 items-center justify-center rounded-full text-on-surface-variant" aria-label="Tutup menu">
            <X aria-hidden="true" className="size-5" />
          </Dialog.Close>
          <SidebarIsi onNavigate={() => onOpenChange(false)} />
          {/* Pegangan geser di tepi kanan laci. */}
          <span aria-hidden="true" className="absolute right-1.5 top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-outline-variant/80" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Buka laci dengan menggeser dari tepi kiri layar (HP/tablet). Gerakan harus dimulai
 * di 24 px pertama dan lebih ke samping daripada ke bawah.
 */
export function useGeserBukaLaci(buka: () => void) {
  useEffect(() => {
    let a: { x: number; y: number } | null = null
    const mulai = (e: TouchEvent) => {
      const t = e.touches[0]
      const lebar = window.matchMedia('(min-width: 1024px)').matches
      a = !lebar && t.clientX <= 24 && !document.querySelector('[role="dialog"][data-state="open"]') ? { x: t.clientX, y: t.clientY } : null
    }
    const gerak = (e: TouchEvent) => {
      if (!a) return
      const t = e.touches[0]
      const dx = t.clientX - a.x
      if (dx > 50 && dx > Math.abs(t.clientY - a.y) * 1.5) {
        a = null
        buka()
      }
    }
    const lepas = () => (a = null)
    window.addEventListener('touchstart', mulai, { passive: true })
    window.addEventListener('touchmove', gerak, { passive: true })
    window.addEventListener('touchend', lepas, { passive: true })
    return () => {
      window.removeEventListener('touchstart', mulai)
      window.removeEventListener('touchmove', gerak)
      window.removeEventListener('touchend', lepas)
    }
  }, [buka])
}
