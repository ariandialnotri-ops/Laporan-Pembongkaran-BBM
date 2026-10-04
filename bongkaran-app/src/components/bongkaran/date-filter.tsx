import { useState } from 'react'
import { addDays, todayIso } from '@/lib/date'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type DatePreset = 'today' | '7d' | 'month' | 'all' | 'custom'
export interface DateRange {
  preset: DatePreset
  /** "YYYY-MM-DD"; kosong = tanpa batas. */
  from: string
  to: string
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'all', label: 'Semua' },
  { key: 'custom', label: 'Pilih tanggal' },
]

export const presetLabel = (p: DatePreset) => PRESETS.find((x) => x.key === p)?.label ?? ''

export function rangeOf(preset: DatePreset, now = new Date()): DateRange {
  const today = todayIso(now)
  if (preset === 'today') return { preset, from: today, to: today }
  if (preset === '7d') return { preset, from: todayIso(addDays(now, -6)), to: today }
  if (preset === 'month') return { preset, from: `${today.slice(0, 8)}01`, to: today }
  return { preset, from: '', to: '' }
}

export function inRange(iso: string, r: DateRange) {
  if (!iso) return r.preset === 'all'
  return (!r.from || iso >= r.from) && (!r.to || iso <= r.to)
}

export function useDateRange(initial: DatePreset = 'month') {
  return useState<DateRange>(() => rangeOf(initial))
}

/** Pilihan rentang tanggal: chip preset, plus dua kolom tanggal untuk rentang bebas. */
export function DateFilter({ value, onChange, label = 'Filter tanggal', id }: { value: DateRange; onChange: (r: DateRange) => void; label?: string; id: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-space-xs">
      <div className="-mx-margin flex gap-space-xs overflow-x-auto px-margin pb-1 [scrollbar-width:none]">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={value.preset === p.key}
            onClick={() => onChange(p.key === 'custom' ? { ...value, preset: 'custom' } : rangeOf(p.key))}
            className={cn(
              'h-11 shrink-0 rounded-full px-4 text-body-sm font-semibold transition-colors duration-200 active:scale-95',
              value.preset === p.key ? 'bg-primary text-on-primary' : 'glass-1 text-on-surface-variant',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="grid grid-cols-2 gap-space-sm">
          <Input id={`${id}-from`} aria-label="Dari tanggal" type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <Input id={`${id}-to`} aria-label="Sampai tanggal" type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  )
}
