import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

/** success = beres, error = anomali/gagal, warn = pengingat (belum dikerjakan), idle = netral. */
export type BannerTone = 'success' | 'error' | 'warn' | 'idle'

const ICON = { success: CircleCheck, error: TriangleAlert, warn: TriangleAlert, idle: CircleDashed }

/**
 * Live verdict under a calculation. Announced politely so a screen reader
 * hears the result change as the operator types.
 */
export function StatusBanner({ tone, title, detail }: { tone: BannerTone; title: string; detail?: string }) {
  const Icon = ICON[tone]
  return (
    <GlassCard
      level={1}
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-space-sm px-space-md py-space-sm',
        tone === 'success' && 'bg-tertiary-fixed/35',
        tone === 'error' && 'variance-pulse bg-error-container/70',
        tone === 'warn' && 'bg-amber-50',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          tone === 'success' && 'bg-tertiary-container text-on-tertiary',
          tone === 'error' && 'bg-error text-on-error',
          tone === 'warn' && 'bg-amber-400 text-amber-950',
          tone === 'idle' && 'bg-surface-container text-on-surface-variant',
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            'text-body-md font-bold',
            tone === 'success' && 'text-on-tertiary-fixed-variant',
            tone === 'error' && 'text-on-error-container',
            tone === 'warn' && 'text-amber-900',
            tone === 'idle' && 'text-on-surface-variant',
          )}
        >
          {title}
        </span>
        {detail ? <span className="tabular text-numeric-sm text-on-surface-variant">{detail}</span> : null}
      </div>
    </GlassCard>
  )
}
