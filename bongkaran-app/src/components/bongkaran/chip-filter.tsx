import { cn } from '@/lib/utils'

/** Baris chip pilihan tunggal yang bisa digeser (mis. saring produk atau status). */
export function ChipFilter<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="group" aria-label={label} className="-mx-space-md flex gap-space-xs overflow-x-auto px-space-md pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 shrink-0 rounded-full px-4 text-body-sm font-semibold transition-colors duration-200 active:scale-95',
            value === o.value ? 'bg-primary text-on-primary' : 'glass-1 text-on-surface-variant hover:text-on-surface',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
