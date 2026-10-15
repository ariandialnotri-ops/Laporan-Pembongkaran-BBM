import { useRef } from 'react'
import { Camera, LoaderCircle, X } from 'lucide-react'
import { Pill } from '@/components/ui/pill'

/** Foto yang sudah diambil tetapi belum dikirim: disimpan di perangkat, diunggah saat form dikirim. */
export type FotoLokal = { id: string; blob: Blob; url: string }

/** Slot foto wajib dengan pratinjau; foto belum diunggah sampai form dikirim. */
export function FotoWajib({
  label,
  hint,
  fotos,
  busy,
  disabled,
  onAdd,
  onRemove,
  wajib = true,
  kamera = true,
}: {
  /** false = opsional (label tanpa "wajib"). */
  wajib?: boolean
  /** true = langsung membuka kamera belakang (tanpa galeri). */
  kamera?: boolean
  label: string
  hint: string
  fotos: FotoLokal[]
  busy: boolean
  disabled: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-tag uppercase text-on-surface-variant">
          {label} {wajib ? '(wajib)' : '(opsional)'}
        </span>
        {fotos.length > 0 ? <Pill tone="success">{fotos.length} foto</Pill> : <Pill tone={wajib ? 'error' : 'neutral'}>Belum</Pill>}
      </div>
      <span className="text-body-sm text-on-surface-variant">{hint}</span>
      <div className="grid grid-cols-3 gap-space-xs">
        {fotos.map((f) => (
          <div key={f.id} className="relative overflow-hidden rounded-md">
            <img src={f.url} alt={label} className="aspect-[3/4] w-full bg-black object-contain" />
            <button
              type="button"
              aria-label={`Hapus foto ${label}`}
              disabled={disabled}
              onClick={() => onRemove(f.id)}
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => ref.current?.click()}
          className="inset-field flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-outline-variant text-body-sm font-semibold text-primary"
        >
          {busy ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
          {busy ? 'Memproses' : 'Ambil foto'}
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture={kamera ? 'environment' : undefined}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onAdd(files)
        }}
      />
    </div>
  )
}

