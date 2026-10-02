import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Bidang tanda tangan jari/stylus. Hasil disimpan sebagai PNG kecil
 * (latar transparan, tinta gelap) agar ringan di database dan tetap tajam
 * di Berita Acara.
 */
export function SignaturePad({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string
  onChange: (dataUrl: string) => void
  label: string
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [editing, setEditing] = useState(!value)

  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0a1c30'
    dirty.current = false
  }, [editing])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (!canvas || !dirty.current) return
    // Perkecil ke lebar 360 px: cukup untuk kolom tanda tangan di Berita Acara.
    const scale = Math.min(1, 360 / canvas.width)
    const out = document.createElement('canvas')
    out.width = Math.round(canvas.width * scale)
    out.height = Math.round(canvas.height * scale)
    out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height)
    onChange(out.toDataURL('image/png'))
  }

  if (!editing && value) {
    return (
      <div className="flex flex-col gap-space-xs">
        <div className="inset-field flex h-32 items-center justify-center rounded-md bg-white/70">
          <img src={value} alt={`Tanda tangan ${label}`} className="max-h-28 max-w-full object-contain" />
        </div>
        {!disabled && (
          <Button variant="soft" size="sm" className="self-start" onClick={() => setEditing(true)}>
            <PenLine aria-hidden="true" />
            Ulangi tanda tangan
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-space-xs">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Area tanda tangan ${label}. Tanda tangani dengan jari.`}
        className={cn('inset-field h-36 w-full touch-none rounded-md bg-white/80', disabled && 'pointer-events-none opacity-60')}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          const ctx = e.currentTarget.getContext('2d')!
          const p = point(e)
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + 0.1, p.y + 0.1)
          ctx.stroke()
          dirty.current = true
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = e.currentTarget.getContext('2d')!
          const p = point(e)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm text-on-surface-variant">Tanda tangani di kotak di atas.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const c = canvasRef.current
            c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
            dirty.current = false
            onChange('')
          }}
        >
          <Eraser aria-hidden="true" />
          Hapus
        </Button>
      </div>
      {value && (
        <Button variant="soft" size="sm" className="self-start" onClick={() => setEditing(false)}>
          Pakai tanda tangan tersimpan
        </Button>
      )}
    </div>
  )
}
