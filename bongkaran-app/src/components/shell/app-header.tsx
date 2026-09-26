import { Link, useLocation } from 'react-router-dom'
import { Fuel } from 'lucide-react'
import { currentUser } from '@/data/mock'
import { titleFor } from '@/lib/nav'

export function AppHeader() {
  const { pathname } = useLocation()

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-surface/70 pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_20px_rgba(0,80,203,0.04)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-space-sm px-margin">
        <div className="flex min-w-0 items-center gap-space-sm">
          <Link
            to="/"
            aria-label="Beranda"
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Fuel aria-hidden="true" className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-headline-md font-bold text-on-surface">{titleFor(pathname)}</h1>
            <span className="text-tag uppercase text-primary">{currentUser.spbu}</span>
          </div>
        </div>

        <Link
          to="/profil"
          className="glass-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-transform duration-200 active:scale-95"
        >
          <span
            aria-hidden="true"
            className="tabular flex size-8 items-center justify-center rounded-full bg-primary-fixed text-body-sm font-bold text-on-primary-fixed"
          >
            {currentUser.initials}
          </span>
          <span className="hidden text-body-sm font-semibold text-on-surface sm:inline">{currentUser.name}</span>
          <span className="sr-only">Buka profil</span>
        </Link>
      </div>
    </header>
  )
}
