import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Camera, Search } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/** Gambar QR (data URL) untuk teks/URL tertentu. */
export function QrImg({ text, size = 160, alt, className }: { text: string; size?: number; alt: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { margin: 1, width: size * 3, errorCorrectionLevel: 'M' })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [text, size])
  return src ? (
    <img src={src} width={size} height={size} alt={alt} className={cn('shrink-0 bg-white [image-rendering:pixelated]', className)} />
  ) : (
    <span aria-hidden="true" style={{ width: size, height: size }} className={cn('block shrink-0 animate-pulse rounded-sm bg-surface-container', className)} />
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opts: { formats: string[] }) => Detector

/**
 * Pemindai QR label APAR/APAB memakai kamera (BarcodeDetector, didukung Chrome Android).
 * Bila tidak didukung, pengguna dapat mengetik kode unit atau memakai aplikasi kamera HP.
 */
export function QrScanner({ open, onClose, onResult, onKode }: { open: boolean; onClose: () => void; onResult: (text: string) => void; onKode: (kode: string) => string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [kode, setKode] = useState('')
  const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  const didukung = !!Ctor && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!open || !didukung || !Ctor) return
    let stream: MediaStream | null = null
    let berhenti = false
    let t: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (berhenti) return stream.getTracks().forEach((x) => x.stop())
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        const det = new Ctor({ formats: ['qr_code'] })
        const loop = async () => {
          if (berhenti) return
          try {
            const hasil = await det.detect(v)
            if (hasil[0]?.rawValue) return onResult(hasil[0].rawValue)
          } catch {
            /* bingkai belum siap */
          }
          t = setTimeout(loop, 250)
        }
        void loop()
      } catch {
        setError('Kamera tidak dapat dibuka. Izinkan akses kamera di browser, atau ketik kode unit di bawah.')
      }
    })()
    return () => {
      berhenti = true
      clearTimeout(t)
      stream?.getTracks().forEach((x) => x.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cari = () => {
    const err = onKode(kode)
    setError(err)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Pindai label QR" description="Arahkan kamera ke label QR pada tabung APAR/APAB.">
      {didukung ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
          <video ref={videoRef} muted playsInline className="size-full object-cover" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-md border-4 border-white/80" />
        </div>
      ) : (
        <div className="flex items-start gap-space-sm rounded-md bg-surface-container-low p-space-sm text-body-sm text-on-surface">
          <Camera aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-on-surface-variant" />
          Browser ini belum mendukung pindai di dalam aplikasi. Pindai label dengan aplikasi kamera HP (label membuka halaman unit), atau ketik kode unit di bawah.
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
        <Field label="Atau ketik kode unit" htmlFor="scan-kode">
          <Input
            id="scan-kode"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Mis. APAR-01"
            value={kode}
            onChange={(e) => {
              setKode(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && cari()}
          />
        </Field>
        <Button variant="soft" onClick={cari}>
          <Search aria-hidden="true" />
          Buka
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-body-sm font-semibold text-error">
          {error}
        </span>
      )}
    </Sheet>
  )
}
