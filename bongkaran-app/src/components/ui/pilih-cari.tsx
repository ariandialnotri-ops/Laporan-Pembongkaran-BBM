import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface OpsiCari {
  value: string
  label: string
  /** Teks kecil (mis. nomor akun, keterangan); ikut dicari. */
  sub?: string
  /** Kata kunci tambahan yang ikut dicari tetapi tidak ditampilkan. */
  kunci?: string
  /** Lencana kecil di kanan, mis. "Saran". */
  tanda?: string
}

/**
 * Dropdown dengan pencarian (gaya aplikasi HP): tombol seperti input menampilkan pilihan, ketuk → bottom sheet
 * berisi kotak cari (label, keterangan, kata kunci) dan daftar pilihan. Dipakai untuk akun COA, kategori
 * pengajuan anggaran, dan daftar panjang lain.
 */
export function PilihCari({ id, value, onChange, options, placeholder = 'Pilih', judul, deskripsi, invalid }: { id?: string; value: string; onChange: (v: string) => void; options: OpsiCari[]; placeholder?: string; judul: string; deskripsi?: string; invalid?: boolean }) {
  const [buka, setBuka] = useState(false)
  const [q, setQ] = useState('')
  const pilih = options.find((o) => o.value === value)
  const hasil = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return options
    const kata = k.split(/\s+/)
    return options.filter((o) => {
      const teks = `${o.label} ${o.sub ?? ''} ${o.kunci ?? ''} ${o.value}`.toLowerCase()
      return kata.every((w) => teks.includes(w))
    })
  }, [q, options])
  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={buka}
        onClick={() => (setQ(''), setBuka(true))}
        className={cn(
          'flex min-h-12 w-full items-center gap-space-xs rounded-md border bg-surface-container-lowest px-space-sm py-1.5 text-left text-body-md shadow-sm transition-colors hover:bg-surface-container-low',
          invalid ? 'border-error' : 'border-outline-variant',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          {pilih ? (
            <>
              <span className="truncate font-semibold text-on-surface">{pilih.label}</span>
              {pilih.sub && <span className="truncate text-xs text-on-surface-variant">{pilih.sub}</span>}
            </>
          ) : (
            <span className="text-on-surface-variant">{placeholder}</span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
      </button>
      <Sheet open={buka} onOpenChange={setBuka} title={judul} description={deskripsi}>
        <div className="flex flex-col gap-space-sm pb-space-md">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <Input autoFocus aria-label={`Cari ${judul.toLowerCase()}`} placeholder="Ketik untuk mencari…" className="pl-9 pr-9" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" aria-label="Hapus pencarian" onClick={() => setQ('')} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant">
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
          <span className="text-xs text-on-surface-variant" role="status">
            {hasil.length} dari {options.length} pilihan
          </span>
          <ul className="flex flex-col divide-y divide-outline-variant/40 rounded-lg bg-surface-container-low">
            {hasil.map((o) => {
              const on = o.value === value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onChange(o.value)
                      setBuka(false)
                    }}
                    className={cn('flex min-h-14 w-full items-center gap-space-sm px-space-sm py-space-xs text-left transition-colors', on ? 'bg-primary/10' : 'hover:bg-surface-container')}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('text-body-md font-semibold', on ? 'text-primary' : 'text-on-surface')}>{o.label}</span>
                      {o.sub && <span className="text-xs leading-snug text-on-surface-variant">{o.sub}</span>}
                    </span>
                    {o.tanda && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{o.tanda}</span>}
                    {on && <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />}
                  </button>
                </li>
              )
            })}
            {!hasil.length && <li className="p-space-md text-center text-body-sm text-on-surface-variant">Tidak ada yang cocok dengan “{q}”.</li>}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
