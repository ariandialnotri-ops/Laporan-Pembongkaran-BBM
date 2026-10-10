import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Camera, CameraOff, Flashlight, ImageUp, RotateCcw, Search } from 'lucide-react'
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
type DetectorCtor = { new (opts: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> }

const FORMAT = ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix']
let detektor: Promise<Detector | null> | null = null

/** BarcodeDetector bawaan (Chrome Android) bila mendukung QR; selain itu null dan dipakai jsQR. */
function siapkanDetektor() {
  detektor ??= (async () => {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
    if (!Ctor) return null
    try {
      const ada = (await Ctor.getSupportedFormats?.()) ?? FORMAT
      const formats = FORMAT.filter((f) => ada.includes(f))
      return formats.includes('qr_code') ? new Ctor({ formats }) : null
    } catch {
      return null
    }
  })()
  return detektor
}

/**
 * Baca kode dari satu gambar/bingkai video. Bingkai diperkecil ke kanvas (maks. `maks` px)
 * agar cepat di HP, lalu dibaca BarcodeDetector atau jsQR (iPhone, Firefox, desktop).
 */
async function bacaKode(src: CanvasImageSource, w: number, h: number, canvas: HTMLCanvasElement, maks: number, teliti: boolean) {
  if (!w || !h) return null
  const det = await siapkanDetektor()
  if (det) {
    try {
      const hasil = await det.detect(src)
      if (hasil[0]?.rawValue) return hasil[0].rawValue
    } catch {
      /* bingkai belum siap: lanjut ke jsQR */
    }
  }
  const skala = Math.min(1, maks / Math.max(w, h))
  canvas.width = Math.round(w * skala)
  canvas.height = Math.round(h * skala)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { default: jsQR } = await import('jsqr')
  return jsQR(img.data, img.width, img.height, { inversionAttempts: teliti ? 'attemptBoth' : 'dontInvert' })?.data || null
}

function pesanKamera(e: unknown) {
  const n = (e as { name?: string })?.name
  if (!window.isSecureContext) return 'Kamera hanya dapat dibuka lewat alamat https. Buka aplikasi dari alamat resmi, atau ambil foto label.'
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Akses kamera ditolak. Izinkan Kamera untuk situs ini (iPhone: Pengaturan > Safari > Kamera > Izinkan), lalu ketuk Coba lagi.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini. Ambil foto label atau ketik kode unit.'
  if (n === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu ketuk Coba lagi.'
  return 'Kamera tidak dapat dibuka. Ketuk Coba lagi, ambil foto label, atau ketik kode unit.'
}

/** Pratinjau kamera belakang yang membaca QR terus-menerus sampai ketemu. */
function Kamera({ onHasil }: { onHasil: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [siap, setSiap] = useState(false)
  const [senter, setSenter] = useState<{ on: boolean; set: (on: boolean) => void } | null>(null)
  const [coba, setCoba] = useState(0)
  const hasilRef = useRef(onHasil)
  useLayoutEffect(() => {
    hasilRef.current = onHasil
  })

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let stream: MediaStream | null = null
    let berhenti = false
    let t: ReturnType<typeof setTimeout> | undefined
    const canvas = document.createElement('canvas')
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('tidak didukung'), { name: window.isSecureContext ? 'NotFoundError' : 'SecurityError' })
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (berhenti) return
        v.srcObject = stream
        await v.play().catch(() => undefined)
        if (berhenti) return
        setSiap(true)
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
        if (caps.torch) {
          const set = (on: boolean) => {
            void track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(() => setSenter({ on, set }), () => undefined)
          }
          setSenter({ on: false, set })
        }
        const loop = async () => {
          if (berhenti) return
          if (v.readyState >= 2) {
            const teks = await bacaKode(v, v.videoWidth, v.videoHeight, canvas, 720, false).catch(() => null)
            if (berhenti) return
            if (teks) {
              berhenti = true
              navigator.vibrate?.(80)
              stream?.getTracks().forEach((x) => x.stop())
              return hasilRef.current(teks)
            }
          }
          t = setTimeout(loop, 180)
        }
        void loop()
      } catch (e) {
        if (!berhenti) setError(pesanKamera(e))
      }
    })()
    return () => {
      berhenti = true
      clearTimeout(t)
      stream?.getTracks().forEach((x) => x.stop())
      v.srcObject = null
    }
  }, [coba])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
      <video ref={videoRef} muted playsInline autoPlay aria-label="Pratinjau kamera" className="size-full object-cover" />
      {!error && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-lg border-4 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          <div aria-hidden="true" className="scan-garis pointer-events-none absolute inset-x-[17%] top-[15%] h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
          <span role="status" className="absolute inset-x-0 bottom-3 text-center text-body-sm font-semibold text-white drop-shadow">
            {siap ? 'Arahkan label QR ke dalam kotak' : 'Membuka kamera…'}
          </span>
        </>
      )}
      {senter && (
        <button
          type="button"
          aria-pressed={senter.on}
          aria-label={senter.on ? 'Matikan senter' : 'Nyalakan senter'}
          onClick={() => senter.set(!senter.on)}
          className={cn('absolute right-2 top-2 flex size-11 items-center justify-center rounded-full', senter.on ? 'bg-amber-300 text-black' : 'bg-black/50 text-white')}
        >
          <Flashlight aria-hidden="true" className="size-5" />
        </button>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-space-sm p-space-md text-center">
          <CameraOff aria-hidden="true" className="size-8 text-white/80" />
          <span role="alert" className="text-body-sm text-white">
            {error}
          </span>
          <Button variant="soft" size="sm" onClick={() => (setError(null), setSiap(false), setSenter(null), setCoba((n) => n + 1))}>
            <RotateCcw aria-hidden="true" />
            Coba lagi
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Pemindai label QR APAR/APAB. Kamera dibaca langsung di aplikasi (BarcodeDetector bila ada,
 * jsQR untuk iPhone & browser lain). Cadangan: foto label dari kamera HP, atau ketik kode unit.
 */
export function QrScanner({ open, onClose, onResult, onKode }: { open: boolean; onClose: () => void; onResult: (text: string) => void; onKode: (kode: string) => string | null }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Pindai label QR" description="Arahkan kamera ke label QR pada tabung APAR/APAB.">
      {open && <IsiPemindai onResult={onResult} onKode={onKode} />}
    </Sheet>
  )
}

/** Isi lembar pindai; dipasang ulang setiap kali dibuka sehingga kamera & isian mulai bersih. */
function IsiPemindai({ onResult, onKode }: { onResult: (text: string) => void; onKode: (kode: string) => string | null }) {
  const [error, setError] = useState<string | null>(null)
  const [kode, setKode] = useState('')
  const [membaca, setMembaca] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  const cari = () => setError(onKode(kode))

  const bacaFoto = async (file: File | undefined) => {
    if (!file) return
    setMembaca(true)
    setError(null)
    try {
      const bmp = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const teks = (await bacaKode(bmp, bmp.width, bmp.height, canvas, 1280, true)) ?? (await bacaKode(bmp, bmp.width, bmp.height, canvas, 720, true))
      bmp.close()
      if (teks) {
        navigator.vibrate?.(80)
        onResult(teks)
      } else setError('QR tidak terbaca pada foto. Foto lebih dekat & tegak lurus, pastikan label terang dan tidak buram, atau ketik kode unit.')
    } catch {
      setError('Foto tidak dapat dibaca. Coba lagi atau ketik kode unit.')
    } finally {
      setMembaca(false)
      if (fotoRef.current) fotoRef.current.value = ''
    }
  }

  return (
    <>
      <Kamera onHasil={onResult} />
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void bacaFoto(e.target.files?.[0])} />
      <Button variant="glass" disabled={membaca} onClick={() => fotoRef.current?.click()}>
        {membaca ? <Camera aria-hidden="true" className="animate-pulse" /> : <ImageUp aria-hidden="true" />}
        {membaca ? 'Membaca foto…' : 'Kamera tidak jalan? Ambil foto label'}
      </Button>
      <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
        <Field label="Label rusak? Ketik kode unit" htmlFor="scan-kode">
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
        <Button variant="soft" disabled={!kode.trim()} onClick={cari}>
          <Search aria-hidden="true" />
          Buka
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-body-sm font-semibold text-error">
          {error}
        </span>
      )}
    </>
  )
}
