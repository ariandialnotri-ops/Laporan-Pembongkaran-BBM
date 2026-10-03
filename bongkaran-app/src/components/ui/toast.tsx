import * as React from 'react'
import { CircleCheck, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type ToastState = { message: string; icon: LucideIcon } | null

const ToastContext = React.createContext<
  ((message: string, icon?: LucideIcon) => void) | null
>(null)

export function useToast() {
  const show = React.useContext(ToastContext)
  if (!show) throw new Error('useToast harus dipakai di dalam ToastProvider')
  return show
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastState>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = React.useCallback(
    (message: string, icon: LucideIcon = CircleCheck) => {
      if (timer.current) clearTimeout(timer.current)
      setToast({ message, icon })
      timer.current = setTimeout(() => setToast(null), 2800)
    },
    [],
  )

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const Icon = toast?.icon ?? CircleCheck

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted and always live, so the message is announced when it
          arrives rather than when the region appears. */}
      <div
        role='status'
        aria-live='polite'
        className='pointer-events-none fixed inset-x-0 top-20 z-[80] flex justify-center px-4'
      >
        <div
          className={cn(
            'glass-3 flex items-center gap-2 rounded-full px-4 py-2.5 text-body-sm font-semibold text-on-surface transition-all duration-300',
            toast
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-4 opacity-0',
          )}
        >
          <Icon aria-hidden='true' className='size-5 text-tertiary' />
          <span>{toast?.message ?? ''}</span>
        </div>
      </div>
    </ToastContext.Provider>
  )
}
