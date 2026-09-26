import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-space-xs', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <span className="text-body-sm text-on-surface-variant">{hint}</span> : null}
    </div>
  )
}

/** Konfirmasi ya/tidak dengan area sentuh penuh satu baris. */
export function CheckRow({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label
      className={cn(
        'inset-field flex min-h-12 cursor-pointer items-start gap-space-sm rounded-md px-3.5 py-3 text-body-md text-on-surface',
        checked && 'bg-primary/10',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

/** Baris angka "label ........ nilai" seperti ladder hitungan di form lama. */
export function Ladder({ rows, total }: { rows: [string, ReactNode][]; total?: [string, ReactNode] }) {
  return (
    <dl className="inset-field flex flex-col gap-1 rounded-md p-space-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <dt className="text-body-sm text-on-surface-variant">{label}</dt>
          <dd className="tabular text-right text-numeric-sm text-on-surface">{value}</dd>
        </div>
      ))}
      {total ? (
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-outline-variant/50 pt-space-xs">
          <dt className="text-body-sm font-bold text-on-surface">{total[0]}</dt>
          <dd className="tabular text-right text-numeric-md font-bold text-primary">{total[1]}</dd>
        </div>
      ) : null}
    </dl>
  )
}
