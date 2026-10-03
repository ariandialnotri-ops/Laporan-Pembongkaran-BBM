import type { ReactNode } from 'react'
import { AmbientOrbs } from './ambient-orbs'
import { AppHeader } from './app-header'
import { DockNav } from './dock-nav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-on-primary"
      >
        Lompat ke konten
      </a>

      <AmbientOrbs />
      <AppHeader />

      {/* pt-20 clears the fixed header; pb-28 clears the floating dock. */}
      <main id="konten" className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-margin pb-28 pt-20">
        {children}
      </main>

      <DockNav />
    </>
  )
}
