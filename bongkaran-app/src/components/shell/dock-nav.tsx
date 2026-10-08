import { Link, useLocation } from 'react-router-dom'
import { useApp } from '@/lib/app-state'
import { activeNav, NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'

/**
 * Floating frosted dock. Anchored above the iOS home indicator via the safe
 * area inset; <main> reserves matching bottom padding so nothing hides behind it.
 */
export function DockNav() {
  const { pathname } = useLocation()
  const { can } = useApp()
  const current = activeNav(pathname)

  return (
    <nav
      aria-label="Navigasi utama"
      className="print:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 px-margin pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="glass-2 pointer-events-auto mx-auto mb-space-sm flex max-w-md items-center justify-between rounded-full p-space-2xs">
        {NAV_ITEMS.filter((item) => can(item.href)).map((item) => {
          const active = current === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-0 py-space-xs transition-all duration-200 active:scale-95',
                active ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Icon aria-hidden="true" className="size-[22px]" />
              <span className="mt-0.5 max-w-full truncate text-tag uppercase tracking-normal">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
