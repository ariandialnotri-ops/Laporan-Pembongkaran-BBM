import { Link, useLocation } from 'react-router-dom'
import { sectionTabsFor } from '@/lib/nav'
import { cn } from '@/lib/utils'

/**
 * Sub-tab menu dock: bentuk segmented control yang sama dengan Tabs, tapi
 * tiap segmen adalah rute sehingga bisa dibuka langsung dan tombol kembali bekerja.
 * Kalimat di bawahnya menjelaskan apa yang dikerjakan di sub-tab aktif.
 */
export function SectionTabs() {
  const { pathname } = useLocation()
  const tabs = sectionTabsFor(pathname)
  if (!tabs) return null
  const index = tabs.findIndex((t) => t.href === pathname)
  const active = tabs[index]

  return (
    <div className="mb-space-md flex flex-col gap-space-xs">
      <nav aria-label="Sub menu" className="glass-1 relative flex items-center gap-1 rounded-full p-1">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,80,203,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {tabs.map((t) => (
          <Link
            key={t.href}
            to={t.href}
            replace
            aria-current={t.href === pathname ? 'page' : undefined}
            className={cn(
              'relative z-10 flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-center text-body-sm font-semibold transition-colors duration-200',
              t.href === pathname ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <span className="truncate">{t.label}</span>
          </Link>
        ))}
      </nav>
      <p className="px-space-xs text-body-sm text-on-surface-variant">{active.hint}</p>
    </div>
  )
}
