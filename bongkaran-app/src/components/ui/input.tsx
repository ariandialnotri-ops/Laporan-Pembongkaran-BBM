import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Recessed frosted field (DESIGN.md "Financial Input Fields"). Text stays at
 * 16px: below that, iOS Safari zooms the viewport on focus.
 */
export function Input({
  className,
  numeric = false,
  suffix,
  ...props
}: React.ComponentProps<'input'> & { numeric?: boolean; suffix?: string }) {
  return (
    // Sentuhan di padding atau satuan (mm, °C) tetap memfokuskan input.
    <div
      onMouseDown={(e) => {
        const input = e.currentTarget.querySelector('input')
        if (input && e.target !== input) {
          e.preventDefault()
          input.focus()
        }
      }}
      className={cn(
        'inset-field flex h-12 cursor-text items-center gap-2 rounded-md px-3.5 transition-shadow duration-200',
        'focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40',
        className,
      )}
    >
      <input
        data-slot="input"
        className={cn(
          'h-full w-full min-w-0 bg-transparent text-body-lg text-on-surface placeholder:text-outline focus:outline-none focus-visible:outline-none',
          numeric && 'tabular text-numeric-md font-semibold',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      />
      {suffix ? (
        <span aria-hidden="true" className="tabular shrink-0 text-numeric-sm text-on-surface-variant">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}
