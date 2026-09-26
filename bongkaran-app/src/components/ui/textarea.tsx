import * as React from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'inset-field min-h-[88px] w-full resize-none rounded-md px-3.5 py-3 text-body-lg text-on-surface placeholder:text-outline',
        'transition-shadow duration-200 focus:bg-white focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-primary/40',
        className,
      )}
      {...props}
    />
  )
}
