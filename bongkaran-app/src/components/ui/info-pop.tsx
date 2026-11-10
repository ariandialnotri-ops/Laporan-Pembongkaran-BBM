import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Tombol ikon Information (44 px) yang membuka pop up penjelasan modul/fitur. Dipakai sebagai pengganti
 * paragraf penjelasan di halaman, supaya layar langsung berisi data & aksi.
 */
export function InfoPop({ judul, children, className, label }: { judul: string; children: ReactNode; className?: string; label?: string }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={label ?? `Informasi ${judul}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setBuka(true)
        }}
        className={cn('touch-44 relative inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed/70 text-primary active:scale-95', className)}
      >
        <Info aria-hidden="true" className="size-[18px]" />
      </button>
      <Sheet open={buka} onOpenChange={setBuka} title={judul}>
        <div className="flex flex-col gap-space-sm pb-space-md text-body-md text-on-surface">{children}</div>
      </Sheet>
    </>
  )
}

/** Baris kecil di atas halaman: ikon Information di kanan, membuka penjelasan fitur. */
export function InfoHalaman({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="animate-entrance-1 -mb-space-xs flex justify-end px-space-xs">
      <InfoPop judul={judul}>{children}</InfoPop>
    </div>
  )
}
