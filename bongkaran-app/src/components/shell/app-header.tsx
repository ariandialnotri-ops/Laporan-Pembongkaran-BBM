import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'
import { useKembali } from './kembali'
import { PemilihSpbu } from './pemilih-spbu'
import { useSidebar } from './sidebar-ctx'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { pathname } = useLocation()
  const app = useApp()
  const kembali = useKembali()
  const sidebar = useSidebar()

  return (
    <header data-glass-bar className={cn('fixed inset-x-0 top-0 z-40 transition-[left] duration-300 motion-reduce:transition-none', !sidebar.tertutup && 'lg:left-72', 'print:hidden bg-surface/70 pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_20px_rgba(0,80,203,0.04)] backdrop-blur-2xl')}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-space-sm px-margin">
        <div className="flex min-w-0 items-center gap-space-sm">
          {/* Menu: HP = buka laci sidebar; layar lebar = sembunyikan/tampilkan sidebar. */}
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label={sidebar.tertutup ? 'Buka menu' : 'Menu'}
            aria-expanded={sidebar.laci}
            className="glass-1 flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-transform duration-200 active:scale-95"
          >
            <Menu aria-hidden="true" className="size-5 lg:hidden" />
            {sidebar.tertutup ? <PanelLeftOpen aria-hidden="true" className="hidden size-5 lg:block" /> : <PanelLeftClose aria-hidden="true" className="hidden size-5 lg:block" />}
          </button>
          {/* Panah kembali hanya di sub menu; menu utama (Dashboard, Operation, ..., Profil) tanpa panah. */}
          {kembali && (
            <button
              type="button"
              aria-label="Kembali"
              onClick={kembali}
              className="glass-1 flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-transform duration-200 active:scale-95"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
          )}
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-headline-md font-bold text-on-surface">{titleFor(pathname, app.role)}</h1>
            <PemilihSpbu />
          </div>
        </div>

        <Link to="/profil" className="glass-1 flex min-h-11 items-center gap-2 rounded-full py-1 pl-1.5 pr-3 transition-transform duration-200 active:scale-95">
          <span aria-hidden="true" className="tabular flex size-8 items-center justify-center rounded-full bg-primary-fixed text-body-sm font-bold text-on-primary-fixed">
            {app.initials}
          </span>
          <span className="hidden max-w-40 truncate text-body-sm font-semibold text-on-surface sm:inline">{app.displayName}</span>
          <span className="sr-only">Buka profil</span>
        </Link>
      </div>
    </header>
  )
}
