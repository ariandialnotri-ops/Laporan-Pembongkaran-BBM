import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const pillVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-tag uppercase [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        /* The fill carries the hue, the text carries the contrast: text
           colours are the AA-verified role tokens, never the bright fills. */
        neutral: 'bg-surface-container-high/80 text-on-surface-variant',
        primary: 'bg-primary-fixed text-on-primary-fixed',
        info: 'bg-surface-container-low/90 text-on-surface-variant',
        success: 'bg-tertiary-fixed/70 text-on-tertiary-fixed-variant',
        error: 'bg-error-container text-on-error-container',
        cyan: 'bg-secondary-fixed/60 text-on-secondary-fixed-variant',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Pill({ className, tone, ...props }: React.ComponentProps<'span'> & VariantProps<typeof pillVariants>) {
  return <span data-slot="pill" className={cn(pillVariants({ tone }), className)} {...props} />
}
