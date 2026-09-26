import { useId } from 'react'
import { Camera, LoaderCircle, X } from 'lucide-react'
import { Pill } from '@/components/ui/pill'
import type { Photo } from '@/lib/sop'
import { cn } from '@/lib/utils'

/**
 * Slot foto evidence untuk satu item SOP: bisa lebih dari satu foto,
 * `capture` membuka kamera belakang di HP.
 */
export function PhotoSlot({
  label,
  photos,
  required = true,
  busy = false,
  disabled = false,
  srcOf,
  onAdd,
  onRemove,
}: {
  label: string
  photos: Photo[]
  required?: boolean
  busy?: boolean
  disabled?: boolean
  srcOf: (p: Photo) => string | undefined
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
}) {
  const id = useId()
  const done = photos.length > 0
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-tag uppercase text-on-surface-variant">
          {label}
        </span>
        {required ? <Pill tone={done ? 'primary' : 'neutral'}>{done ? `${photos.length} foto` : 'Wajib'}</Pill> : <Pill>Opsional</Pill>}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-space-xs sm:grid-cols-4">
          {photos.map((p, i) => {
            const src = srcOf(p)
            return (
              <div key={p.id} className="glass-1 relative aspect-square overflow-hidden rounded-md">
                {src ? (
                  <img src={src} alt={`${label} ${i + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-on-surface-variant">
                    <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Hapus foto ${i + 1} ${label}`}
                    className="glass-3 absolute right-1 top-1 flex size-8 items-center justify-center rounded-full text-on-surface touch-44"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!disabled && (
        <label
          htmlFor={id}
          className={cn(
            'inset-field flex cursor-pointer items-center justify-center gap-space-sm rounded-lg border-[1.5px] border-dashed border-outline-variant transition-colors duration-200 hover:border-primary focus-within:ring-2 focus-within:ring-primary/40',
            done ? 'h-14' : 'h-24 flex-col',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-sm">
            {busy ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
          </span>
          <span className="text-body-sm font-semibold text-on-surface-variant">
            {busy ? 'Memproses foto…' : done ? 'Tambah foto' : 'Ambil / Unggah Foto'}
          </span>
          <input
            id={id}
            aria-labelledby={`${id}-label`}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) onAdd(files)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
