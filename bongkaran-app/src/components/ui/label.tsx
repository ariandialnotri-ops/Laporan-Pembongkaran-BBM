import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

/** Uppercase micro-label with +0.05em tracking for glare-prone forecourts. */
export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-tag uppercase text-on-surface-variant', className)} {...props} />
}
