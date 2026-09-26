import * as React from 'react'
import { cn } from '@/lib/utils'

const LEVEL = {
  1: 'glass-1',
  2: 'glass-2',
  3: 'glass-3',
} as const

/**
 * A frosted surface. `level` picks the elevation recipe from DESIGN.md:
 * 1 sub-glass panels, 2 interactive cards, 3 modals and urgent banners.
 */
export function GlassCard({
  level = 2,
  className,
  rim = true,
  ...props
}: React.ComponentProps<'div'> & { level?: 1 | 2 | 3; rim?: boolean }) {
  return <div data-slot="glass-card" className={cn(LEVEL[level], rim && 'rim-light', 'rounded-lg', className)} {...props} />
}
