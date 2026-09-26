import { Link, useLocation } from 'react-router-dom'
import { isRouteActive, NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'

/**
 * Floating frosted dock. Anchored above the iOS home indicator via the safe
 * area inset; <main> reserves matching bottom padding so nothing hides behind it.
 */
export function DockNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Navigasi utama"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-margin pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="glass-2 pointer-events-auto mx-auto mb-space-sm flex max-w-md items-center justify-between rounded-full p-space-2xs">
        {NAV_ITEMS.map((item) => {
          const active = isRouteActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-1 flex-col items-center justify-center rounded-full px-space-2xs py-space-xs transition-all duration-200 active:scale-95',
                active ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Icon aria-hidden="true" className="size-[22px]" />
              <span className="mt-0.5 text-tag uppercase">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
