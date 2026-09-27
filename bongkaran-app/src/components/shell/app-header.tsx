import { Link, useLocation } from 'react-router-dom'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'

export function AppHeader() {
  const { pathname } = useLocation()
  const app = useApp()

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-surface/70 pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_20px_rgba(0,80,203,0.04)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-space-sm px-margin">
        <div className="flex min-w-0 items-center gap-space-sm">
          <Link
            to="/"
            aria-label="FLOQ — Beranda"
            className="touch-44 shrink-0 rounded-md shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <img src="/floq-icon.webp" alt="" width={128} height={128} className="size-9" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-headline-md font-bold text-on-surface">{titleFor(pathname)}</h1>
            <span className="truncate text-tag uppercase text-primary">{app.settings.namaSpbu || 'SPBU'}</span>
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
