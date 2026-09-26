import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* White on #0050cb is 6.98:1. */
        primary:
          'bg-primary text-on-primary shadow-[0_8px_24px_rgba(0,102,255,0.28)] hover:bg-primary-container active:scale-[0.97]',
        /* Frosted pill, text in primary blue (DESIGN.md "Secondary Glass"). */
        glass: 'glass-2 text-primary hover:bg-white/85 active:scale-[0.97]',
        soft: 'bg-surface-container-low text-primary hover:bg-surface-container active:scale-95',
        ghost: 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-95',
        danger: 'bg-error text-on-error hover:bg-error/90 active:scale-[0.97]',
      },
      size: {
        /* 44px minimum touch target throughout. */
        default: 'h-11 rounded-md px-4 text-body-md [&_svg]:size-[18px]',
        lg: 'h-14 rounded-lg px-5 text-body-md [&_svg]:size-6',
        sm: 'h-11 rounded-full px-3 text-body-sm [&_svg]:size-4',
        pill: 'h-11 rounded-full px-5 text-body-md [&_svg]:size-[18px]',
        icon: 'size-11 rounded-full [&_svg]:size-[18px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
