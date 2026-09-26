import { useEffect, useId, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

/**
 * A real file input with an object-URL preview, like the struk attachment in
 * Tepat Setoran. `capture` opens the rear camera on phones.
 */
export function PhotoField({ label, onFileChange }: { label: string; onFileChange?: (file: File | null) => void }) {
  const id = useId()
  const [preview, setPreview] = useState<string | null>(null)
  const current = useRef<string | null>(null)

  const replace = (file: File | null) => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = file ? URL.createObjectURL(file) : null
    setPreview(current.current)
    onFileChange?.(file)
  }

  // Release the last object URL when the field unmounts.
  useEffect(() => () => {
    if (current.current) URL.revokeObjectURL(current.current)
  }, [])

  return (
    <div className="flex flex-col gap-space-xs">
      <span id={`${id}-label`} className="text-tag uppercase text-on-surface-variant">
        {label}
      </span>
      {preview ? (
        <div className="glass-1 relative overflow-hidden rounded-lg">
          <img src={preview} alt={`Pratinjau ${label}`} className="h-40 w-full object-cover" />
          <button
            type="button"
            onClick={() => replace(null)}
            aria-label={`Hapus ${label}`}
            className="glass-3 absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-on-surface"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="inset-field flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-outline-variant transition-colors duration-200 hover:border-primary focus-within:ring-2 focus-within:ring-primary/40"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-sm">
            <Camera aria-hidden="true" className="size-5" />
          </span>
          <span className="text-body-sm font-semibold text-on-surface-variant">Ambil / Unggah Foto</span>
          <input
            id={id}
            aria-labelledby={`${id}-label`}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => replace(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  )
}
