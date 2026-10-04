import { useCallback, useRef, useState } from 'react'
import { Check, Eraser, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { trimCanvas } from '@/lib/signature'
import { cn } from '@/lib/utils'

/**
 * Tanda tangan jari/stylus. Ketuk kotak untuk membuka pop up berisi kotak
 * panduan bergaris (rasio sama dengan kolom tanda tangan di Berita Acara).
 * Hasil dipotong ke batas tinta, sehingga tampil penuh dan di tengah kotak BA.
 */
export function SignaturePad({ value, onChange, label, disabled }: { value: string; onChange: (dataUrl: string) => void; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={value ? `Tanda tangan ${label}. Ketuk untuk mengulang` : `Ketuk untuk tanda tangan ${label}`}
        className={cn(
          'relative flex aspect-[5/2] max-h-40 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-white/80 transition-colors active:scale-[0.99] disabled:active:scale-100',
          value ? 'border-outline-variant' : 'border-primary/50 text-primary hover:bg-primary-fixed/30',
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="max-h-[85%] max-w-[90%] object-contain" />
            {!disabled && (
              <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-2 py-0.5 text-body-sm font-semibold text-primary shadow-sm">
                <PenLine aria-hidden="true" className="size-3.5" />
                Ulangi
              </span>
            )}
          </>
        ) : (
          <span className="flex flex-col items-center gap-1">
            <PenLine aria-hidden="true" className="size-6" />
            <span className="text-body-md font-semibold">Ketuk untuk tanda tangan</span>
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={`Tanda tangan ${label}`} description="Tanda tangani di dalam kotak bergaris, isi kotak selebar mungkin.">
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
      </Sheet>
    </>
  )
}

function Pad({ label, onSave, onCancel }: { label: string; onSave: (img: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [kosong, setKosong] = useState(true)

  // Ukuran canvas diambil dari ukuran layout (offsetWidth), tidak terpengaruh animasi sheet.
  const attach = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.offsetWidth * ratio)
    canvas.height = Math.round(canvas.offsetHeight * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 3
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
    <>
      <div className="relative aspect-[5/2] w-full overflow-hidden rounded-md bg-white shadow-inner">
        {/* Kotak panduan: area yang dipakai di Berita Acara. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-sm border-2 border-dashed border-primary/60" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-[22%] flex items-end border-b border-outline-variant">
          <span className="-mb-1 text-headline-md leading-none text-outline">×</span>
        </div>
        {kosong && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-md text-outline">
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
      <span className="text-body-sm text-on-surface-variant">Tanda tangan dipotong otomatis mengikuti tinta, lalu ditempatkan di tengah kolom tanda tangan Berita Acara.</span>
      <div className="flex gap-space-sm">
        <Button variant="glass" onClick={kosong ? onCancel : hapus}>
          <Eraser aria-hidden="true" />
          {kosong ? 'Batal' : 'Hapus'}
        </Button>
        <Button
          className="flex-1"
          disabled={kosong}
          onClick={() => {
            const img = canvasRef.current && trimCanvas(canvasRef.current)
            if (img) onSave(img)
          }}
        >
          <Check aria-hidden="true" />
          Simpan tanda tangan
        </Button>
      </div>
    </>
  )
}
