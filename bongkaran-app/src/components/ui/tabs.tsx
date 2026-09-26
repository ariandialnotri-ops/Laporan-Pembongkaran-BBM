import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

/**
 * Frosted segmented control with a sliding indicator, the same shape as the
 * method switch in Tepat Setoran. `count` and `index` place the indicator;
 * Radix still owns the tablist semantics and arrow-key navigation.
 */
function TabsList({
  className,
  children,
  count,
  index,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { count: number; index: number }) {
  return (
    <TabsPrimitive.List className={cn('glass-1 relative flex items-center gap-1 rounded-full p-1', className)} {...props}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,80,203,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: `calc((100% - 8px) / ${count})`, transform: `translateX(${index * 100}%)` }}
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative z-10 flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-body-sm font-semibold text-on-surface-variant transition-colors duration-200',
        'data-[state=active]:text-primary [&_svg]:size-[18px] [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-space-md focus-visible:outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
