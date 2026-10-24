import { useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseAngka } from '@/lib/format'
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

/** Pilihan tunggal berbentuk tombol pil (mis. shift 1/2), tiap opsi minimal 44 px. */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inset-field grid auto-cols-fr grid-flow-col gap-1 rounded-md p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 rounded-[0.6rem] px-3 text-body-sm font-semibold transition-colors duration-200',
            value === o.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Daftar nomor (mis. nomor segel): ketik lalu Enter atau tombol Tambah. */
export function TagInput({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const add = (input: HTMLInputElement) => {
    const parts = input.value
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (!parts.length) return
    onChange([...values, ...parts.filter((p) => !values.includes(p))])
    input.value = ''
  }
  return (
    <div className="flex flex-col gap-space-xs">
      {values.length > 0 && (
        <ul aria-label="Nomor tersimpan" className="flex flex-wrap gap-space-xs">
          {values.map((v) => (
            <li key={v} className="tabular flex h-9 items-center gap-1 rounded-full bg-primary-fixed pl-3 text-body-sm font-semibold text-on-primary-fixed">
              {v}
              <button
                type="button"
                aria-label={`Hapus ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="touch-44 flex size-9 items-center justify-center rounded-full"
              >
                <span aria-hidden="true" className="text-body-md leading-none">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-space-xs">
        <input
          id={id}
          autoComplete="off"
          inputMode="numeric"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(e.currentTarget)
            }
          }}
          className="inset-field tabular h-12 min-w-0 flex-1 rounded-md px-3.5 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={(e) => add((e.currentTarget.previousElementSibling as HTMLInputElement) ?? null)}
          className="h-12 shrink-0 rounded-md bg-surface-container-low px-4 text-body-sm font-semibold text-primary active:scale-95"
        >
          Tambah
        </button>
      </div>
    </div>
  )
}

/** Isian bilangan bulat 0..max (mis. jumlah pulau pompa). */
export function JumlahField({ id, label, value, max, onChange }: { id: string; label: string; value: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => (value ? String(value) : ''))
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        numeric
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseAngka(e.target.value)
          onChange(n !== null && n >= 0 ? Math.min(Math.round(n), max) : 0)
        }}
      />
    </Field>
  )
}
