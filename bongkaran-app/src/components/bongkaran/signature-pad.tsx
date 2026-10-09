import { useCallback, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Eraser, PenLine, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trimCanvas } from '@/lib/signature'
import { cn } from '@/lib/utils'

/**
 * Tanda tangan jari/stylus. Ketuk tombol untuk membuka layar penuh berisi area tanda
 * tangan besar; setelah selesai, pratinjau ditampilkan dan harus dikonfirmasi dulu.
 * Hasil dipotong ke batas tinta, sehingga tampil penuh dan di tengah kotak BA.
 * Tanda tangan yang sudah ada tampil ringkas (informasi minor).
 */
export function SignaturePad({ value, onChange, label, disabled }: { value: string; onChange: (dataUrl: string) => void; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {value ? (
        <div className="flex items-center gap-space-sm rounded-md border border-outline-variant/60 bg-white/80 px-space-sm py-1.5">
          <img src={value} alt={`Tanda tangan ${label}`} className="h-12 w-28 shrink-0 object-contain" />
          <span className="flex-1 text-body-sm text-on-surface-variant">Tersimpan</span>
          {!disabled && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Tanda tangan ${label}. Ketuk untuk mengulang`}>
              <PenLine aria-hidden="true" />
              Ulangi
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-label={`Ketuk untuk tanda tangan ${label}`}
          className="flex min-h-16 w-full items-center justify-center gap-space-xs rounded-md border-2 border-dashed border-primary/50 bg-white/80 text-primary transition-colors hover:bg-primary-fixed/30 active:scale-[0.99] disabled:opacity-60"
        >
          <PenLine aria-hidden="true" className="size-5" />
          <span className="text-body-md font-semibold">Ketuk untuk tanda tangan</span>
        </button>
      )}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-on-surface/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[61] flex flex-col bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] focus:outline-none"
          >
            {open && (
              <Pad
                label={label}
                onCancel={() => setOpen(false)}
                onSave={(img) => {
                  onChange(img)
                  setOpen(false)
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function Pad({ label, onSave, onCancel }: { label: string; onSave: (img: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [kosong, setKosong] = useState(true)
  // Pratinjau hasil potong: menunggu konfirmasi sebelum disimpan.
  const [pratinjau, setPratinjau] = useState<string | null>(null)

  // Ukuran canvas diambil dari ukuran layout (offsetWidth), tidak terpengaruh animasi.
  const attach = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.offsetWidth * ratio)
    canvas.height = Math.round(canvas.offsetHeight * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0a1c30'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => ({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })

  const hapus = () => {
    const c = canvasRef.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setKosong(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-space-sm p-space-sm">
      <div className="flex items-start gap-space-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <Dialog.Title className="text-headline-md font-bold text-on-surface">Tanda tangan {label}</Dialog.Title>
          <span className="text-body-sm text-on-surface-variant">{pratinjau ? 'Periksa tanda tangan sebelum disimpan.' : 'Tanda tangani di dalam kotak bergaris. Putar HP mendatar untuk area lebih lebar.'}</span>
        </div>
        <Dialog.Close aria-label="Tutup" className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low active:scale-95">
          <X aria-hidden="true" className="size-5" />
        </Dialog.Close>
      </div>

      {/* Area gambar tetap terpasang selama konfirmasi, agar "Ulangi" bisa melanjutkan coretan. */}
      <div className={cn('relative min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-white shadow-inner ring-1 ring-outline-variant/60', pratinjau && 'hidden')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-md border-2 border-dashed border-primary/60" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-[22%] flex items-end border-b border-outline-variant">
          <span className="-mb-1 text-headline-lg leading-none text-outline">×</span>
        </div>
        {kosong && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-lg text-outline">
            Tanda tangan di dalam kotak
          </span>
        )}
        <canvas
          ref={attach}
          role="img"
          aria-label={`Area tanda tangan ${label}. Tanda tangani dengan jari di dalam kotak bergaris.`}
          className="absolute inset-0 size-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            const ctx = e.currentTarget.getContext('2d')!
            const p = point(e)
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p.x + 0.1, p.y + 0.1)
            ctx.stroke()
            setKosong(false)
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = e.currentTarget.getContext('2d')!
            const p = point(e)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      </div>

      {pratinjau && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-space-sm rounded-lg bg-surface-container-low p-space-md">
          <div className="flex aspect-[5/2] w-full max-w-md items-center justify-center rounded-md border border-outline-variant bg-white p-space-sm">
            <img src={pratinjau} alt={`Pratinjau tanda tangan ${label}`} className="max-h-full max-w-full object-contain" />
          </div>
          <span className="text-center text-body-md font-semibold text-on-surface">Gunakan tanda tangan ini untuk {label}?</span>
          <span className="text-center text-body-sm text-on-surface-variant">Tanda tangan ditempatkan di tengah kolom tanda tangan Berita Acara.</span>
        </div>
      )}

      {pratinjau ? (
        <div className="flex gap-space-sm">
          <Button size="lg" variant="glass" onClick={() => setPratinjau(null)}>
            <RotateCcw aria-hidden="true" />
            Ulangi
          </Button>
          <Button size="lg" className="flex-1" onClick={() => onSave(pratinjau)}>
            <Check aria-hidden="true" />
            Ya, simpan tanda tangan
          </Button>
        </div>
      ) : (
        <div className="flex gap-space-sm">
          <Button size="lg" variant="glass" onClick={kosong ? onCancel : hapus}>
            <Eraser aria-hidden="true" />
            {kosong ? 'Batal' : 'Hapus'}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={kosong}
            onClick={() => {
              const img = canvasRef.current && trimCanvas(canvasRef.current)
              if (img) setPratinjau(img)
            }}
          >
            <Check aria-hidden="true" />
            Simpan tanda tangan
          </Button>
        </div>
      )}
    </div>
  )
}
