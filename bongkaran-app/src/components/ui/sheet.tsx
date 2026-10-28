import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Lembar bawah (bottom sheet) bergaya kaca level 3 untuk edit cepat dan
 * detail, seperti sheet di aplikasi Android/iOS. Radix menangani fokus,
 * tombol Escape, dan aria-modal.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-on-surface/30" />
        <Dialog.Content
          className={cn(
            'sheet-content glass-3 fixed inset-x-0 bottom-0 z-[61] mx-auto flex w-full max-w-xl flex-col rounded-t-xl pb-[env(safe-area-inset-bottom,0px)] focus:outline-none',
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-outline-variant" />
          <div className="flex items-start gap-space-sm px-space-md pb-space-sm pt-space-sm">
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="text-headline-md font-bold text-on-surface">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-body-sm text-on-surface-variant">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low active:scale-95"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-space-md overflow-y-auto overscroll-contain px-space-md pb-space-md">{children}</div>
          {footer ? <div className="flex gap-space-sm border-t border-outline-variant/50 px-space-md py-space-sm">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
