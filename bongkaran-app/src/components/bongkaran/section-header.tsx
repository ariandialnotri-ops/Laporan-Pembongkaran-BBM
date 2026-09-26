import type { ReactNode } from 'react'

export function SectionHeader({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 px-space-xs">
      <h2 id={id} className="scroll-mt-24 text-headline-md font-bold text-on-surface">
        {title}
      </h2>
      {action}
    </div>
  )
}
