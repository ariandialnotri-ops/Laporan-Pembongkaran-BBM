import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '@/lib/app-state'
import { cn } from '@/lib/utils'
import { AmbientOrbs } from './ambient-orbs'
import { AppHeader } from './app-header'
import { DockNav } from './dock-nav'
import { PlanReminder } from './plan-reminder'
import { IndikatorSegarkan } from './pull-segarkan'
import { usePullSegarkan } from './use-pull-segarkan'
import { useCatatJejak, useGeserKembali, useKembali } from './kembali'
import { SidebarLaci, SidebarTetap } from './sidebar'
import { SidebarContext } from './sidebar-ctx'
import { VersiBaru } from './versi-baru'
import { useViewportVars } from './viewport'

const KUNCI_TUTUP = 'floq-sidebar-tutup'
const bacaTutup = () => {
  try {
    return localStorage.getItem(KUNCI_TUTUP) === '1'
  } catch {
    return false
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  useViewportVars()
  const { pathname } = useLocation()
  // Laci terbuka untuk halaman tempat ia dibuka; pindah halaman otomatis menutupnya.
  const [laciDi, setLaciDi] = useState<string | null>(null)
  const laci = laciDi === pathname
  const setLaci = useCallback((o: boolean) => setLaciDi(o ? window.location.pathname : null), [])
  const [tertutup, setTertutup] = useState(bacaTutup)
  useCatatJejak()
  const { refresh, status } = useApp()
  const segar = usePullSegarkan(() => (status === 'ready' ? refresh() : Promise.resolve()))
  useGeserKembali(useKembali())

  const toggle = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setTertutup((t) => {
        try {
          localStorage.setItem(KUNCI_TUTUP, t ? '0' : '1')
        } catch {
          /* mode privat: tetap berlaku selama halaman terbuka */
        }
        return !t
      })
    } else setLaciDi((di) => (di === window.location.pathname ? null : window.location.pathname))
  }, [])
  const ctx = useMemo(() => ({ laci, setLaci, tertutup, toggle }), [laci, setLaci, tertutup, toggle])

  return (
    <SidebarContext.Provider value={ctx}>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-on-primary"
      >
        Lompat ke konten
      </a>

      <div className="print:hidden">
        <AmbientOrbs />
      </div>
      <SidebarTetap tertutup={tertutup} />
      <SidebarLaci open={laci} onOpenChange={setLaci} />
      <AppHeader />
      <IndikatorSegarkan tarik={segar.tarik} sibuk={segar.sibuk} />

      {/* Ruang untuk header tetap (+ notch), bar bawah (+ garis home iPhone), dan sidebar di layar lebar. */}
      <div className={cn('transition-[padding] duration-300 motion-reduce:transition-none print:p-0', !tertutup && 'lg:pl-72')}>
        <main
          id="konten"
          className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-margin pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-[calc(5rem+env(safe-area-inset-top,0px))] lg:pb-12 print:max-w-none print:p-0"
        >
          {/* Kunci berganti setelah tarik-segarkan: isi halaman dipasang ulang dan memuat ulang datanya. */}
          <div key={segar.kunci} className="flex flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>

      <DockNav />
      <PlanReminder />
      <VersiBaru />
    </SidebarContext.Provider>
  )
}
