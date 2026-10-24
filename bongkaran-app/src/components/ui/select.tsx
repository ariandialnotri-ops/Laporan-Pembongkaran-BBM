import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

/**
 * Ketukan di luar daftar yang barusan menutup dropdown. Di layar sentuh Radix menutup daftar saat
 * pointerdown di luar (selama terbuka tombol pemicu tidak menerima pointer), tetapi "click" dari
 * ketukan yang sama lalu mendarat di tombol pemicu dan membuka daftar lagi, sehingga dropdown tidak
 * bisa ditutup lewat tombolnya. Click "hantu" itu (tanpa pointerdown di tombol) diabaikan.
 */
let tutupLuar = { x: -1, y: -1, waktu: 0 }

function klikHantu(el: HTMLElement) {
  if (Date.now() - tutupLuar.waktu > 1000) return false
  const r = el.getBoundingClientRect()
  return tutupLuar.x >= r.left && tutupLuar.x <= r.right && tutupLuar.y >= r.top && tutupLuar.y <= r.bottom
}

function SelectTrigger({ className, children, onPointerDown, onClick, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      onPointerDown={(e) => {
        // Ketukan baru yang sungguh mengenai tombol: bukan click hantu.
        tutupLuar = { x: -1, y: -1, waktu: 0 }
        onPointerDown?.(e)
      }}
      onClick={(e) => {
        onClick?.(e)
        if (klikHantu(e.currentTarget)) e.preventDefault()
        tutupLuar = { x: -1, y: -1, waktu: 0 }
      }}
      className={cn(
        'inset-field flex h-12 w-full items-center justify-between gap-2 rounded-md px-3.5 text-left text-body-lg text-on-surface',
        'transition-shadow duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'data-[placeholder]:text-on-surface-variant',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-sm">
          <ChevronsUpDown className="size-4" aria-hidden="true" />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        onPointerDownOutside={(e) => {
          onPointerDownOutside?.(e)
          const o = e.detail.originalEvent
          tutupLuar = { x: o.clientX, y: o.clientY, waktu: Date.now() }
        }}
        className={cn(
          // Latar padat: teks di belakang daftar tidak ikut terlihat (terutama di iOS tanpa blur).
          'z-[70] overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-[0_12px_32px_rgba(15,23,42,0.18)]',
          // Daftar panjang dibatasi setinggi ruang yang tersedia di layar, lalu digulir.
          position === 'popper' && 'max-h-[min(var(--radix-select-content-available-height),24rem)] w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="overscroll-contain p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex min-h-11 cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-9 text-body-md text-on-surface outline-none',
        'data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:font-semibold',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center">
        <Check className="size-4 text-primary" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem }
