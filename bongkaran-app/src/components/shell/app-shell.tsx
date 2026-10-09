import type { ReactNode } from 'react'
import { AmbientOrbs } from './ambient-orbs'
import { AppHeader } from './app-header'
import { DockNav } from './dock-nav'
import { PlanReminder } from './plan-reminder'
import { useViewportVars } from './viewport'

export function AppShell({ children }: { children: ReactNode }) {
  useViewportVars()
  return (
    <>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-on-primary"
      >
        Lompat ke konten
      </a>

      <div className="print:hidden">
        <AmbientOrbs />
      </div>
      <AppHeader />

      {/* Ruang untuk header tetap (+ notch) dan dock melayang (+ garis home iPhone). */}
      <main
        id="konten"
        className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-margin pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(5rem+env(safe-area-inset-top,0px))] print:max-w-none print:p-0"
      >
        {children}
      </main>

      <DockNav />
      <PlanReminder />
    </>
  )
}
