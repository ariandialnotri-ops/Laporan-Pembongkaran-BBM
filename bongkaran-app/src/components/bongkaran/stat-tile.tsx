import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: 'default' | 'primary' | 'success' | 'error' | 'cyan'
  className?: string
}) {
  const toneClass = {
    default: 'text-on-surface',
    primary: 'text-primary',
    success: 'text-tertiary',
    error: 'text-error',
    cyan: 'text-secondary',
  }[tone]

  return (
    <GlassCard level={1} className={cn('flex flex-col gap-1 p-space-sm', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-tag uppercase text-on-surface-variant">{label}</span>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
      </div>
      <span className={cn('tabular text-numeric-md font-bold sm:text-numeric-lg', toneClass)}>{value}</span>
      {hint ? <span className="text-body-sm text-on-surface-variant">{hint}</span> : null}
    </GlassCard>
  )
}
