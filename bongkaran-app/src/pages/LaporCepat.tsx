import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Flashlight, ImagePlus, RotateCcw, Square, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { capFoto, capWaktu, compressImage, genId } from '@/lib/image'
import { JENIS_HENTI, JENIS_INSIDEN, type JenisInsiden } from '@/lib/insiden'
import { lihatMedia, titipMedia, type MediaLapor } from '@/lib/lapor-media'
import { cn } from '@/lib/utils'

const MAKS_FOTO = 4
const MAKS_DETIK = 30
/** Ukuran berkas maksimal di penyimpanan (8 MB). */
const MAKS_BYTE = 8 * 1024 * 1024
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

function pesanKamera(e: unknown) {
  const n = (e as { name?: string })?.name
  if (!window.isSecureContext) return 'Kamera hanya dapat dibuka lewat alamat https. Pakai tombol Ambil dari kamera HP di bawah.'
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Akses kamera ditolak. Izinkan Kamera untuk situs ini (iPhone: Pengaturan > Safari > Kamera > Izinkan), lalu ketuk Coba lagi.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini.'
  if (n === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu ketuk Coba lagi.'
  return 'Kamera tidak dapat dibuka. Ketuk Coba lagi atau pakai tombol Ambil dari kamera HP.'
}

/** Rasio jendela kamera (lebar : tinggi), sama dengan hasil foto/video. */
const RASIO = 3 / 4

/**
 * Potongan tengah bingkai kamera dengan rasio jendela pratinjau (sama seperti object-cover), supaya
 * foto/video yang tersimpan persis seperti yang terlihat di layar beserta garis bantu 3×3.
 */
function potongan(v: HTMLVideoElement) {
  const vw = v.videoWidth
  const vh = v.videoHeight
  return vw / vh > RASIO ? { sx: (vw - vh * RASIO) / 2, sy: 0, sw: vh * RASIO, sh: vh } : { sx: 0, sy: (vh - vw / RASIO) / 2, sw: vw, sh: vw / RASIO }
}

/** Format video yang didukung browser (iPhone: mp4, Android/Chrome: webm). */
function formatVideo() {
  if (typeof MediaRecorder === 'undefined') return null
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

/**
 * Tombol Lapor (tengah bar bawah): langsung membuka kamera. Mode Foto atau Video, semuanya bercap
 * tanggal & jam serta nama SPBU. Setelah itu pilih jenis laporan (insiden, near miss, kerusakan)
 * dan form khusus jenis itu terbuka dengan foto/video terlampir.
 */
export function LaporCepat() {
  const app = useApp()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rekamRef = useRef<{ rec: MediaRecorder; stop: () => void } | null>(null)
  const [mode, setMode] = useState<'foto' | 'video'>('foto')
  const [media, setMedia] = useState<MediaLapor[]>(() => lihatMedia())
  const [error, setError] = useState<string | null>(null)
  const [siap, setSiap] = useState(false)
  const [coba, setCoba] = useState(0)
  const [jam, setJam] = useState(() => capWaktu())
  const [detik, setDetik] = useState<number | null>(null)
  const [senter, setSenter] = useState<{ on: boolean; set: (on: boolean) => void } | null>(null)
  const [langkah, setLangkah] = useState<'kamera' | 'jenis'>('kamera')
  const [kilat, setKilat] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const spbu = app.settings.namaSpbu || 'SPBU'
  const nFoto = media.filter((m) => m.jenis === 'foto').length
  const adaVideo = media.some((m) => m.jenis === 'video')
  const fmtVideo = formatVideo()

  // Jam berjalan di pratinjau (cap yang sama ditulis ke foto/video).
  useEffect(() => {
    const t = setInterval(() => setJam(capWaktu()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (langkah !== 'kamera') return
    const v = videoRef.current
    if (!v) return
    let batal = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('tidak didukung'), { name: window.isSecureContext ? 'NotFoundError' : 'SecurityError' })
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        if (batal) return void s.getTracks().forEach((x) => x.stop())
        streamRef.current = s
        v.srcObject = s
        await v.play().catch(() => undefined)
        if (batal) return
        setError(null)
        setSiap(true)
        const track = s.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
        if (caps.torch) {
          const set = (on: boolean) => void track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(() => setSenter({ on, set }), () => undefined)
          setSenter({ on: false, set })
        }
      } catch (e) {
        if (!batal) setError(pesanKamera(e))
      }
    })()
    return () => {
      batal = true
      rekamRef.current?.stop()
      streamRef.current?.getTracks().forEach((x) => x.stop())
      streamRef.current = null
      v.srcObject = null
      setSiap(false)
    }
  }, [coba, langkah])

  const tambah = (m: MediaLapor) => setMedia((x) => [...x, m])
  const hapus = (id: string) =>
    setMedia((x) => {
      const t = x.find((m) => m.id === id)
      if (t) URL.revokeObjectURL(t.url)
      return x.filter((m) => m.id !== id)
    })

  const foto = async () => {
    const v = videoRef.current
    if (!v || v.readyState < 2 || nFoto >= MAKS_FOTO) return
    const p = potongan(v)
    const skala = Math.min(1, 1600 / Math.max(p.sw, p.sh))
    const c = document.createElement('canvas')
    c.width = Math.round(p.sw * skala)
    c.height = Math.round(p.sh * skala)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, p.sx, p.sy, p.sw, p.sh, 0, 0, c.width, c.height)
    const waktu = capWaktu()
    capFoto(ctx, c.width, c.height, [waktu, spbu])
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82))
    c.width = 0
    if (!blob) return setError('Gagal mengambil foto.')
    navigator.vibrate?.(40)
    setKilat(true)
    setTimeout(() => setKilat(false), 150)
    tambah({ id: genId('m'), jenis: 'foto', blob, url: URL.createObjectURL(blob), waktu })
  }

  /** Rekam video lewat kanvas supaya cap tanggal & jam ikut tertulis di setiap bingkai. */
  const mulaiRekam = () => {
    const v = videoRef.current
    if (!v || v.readyState < 2 || !fmtVideo || adaVideo) return
    const p = potongan(v)
    const skala = Math.min(1, 1280 / Math.max(p.sw, p.sh))
    const c = document.createElement('canvas')
    // Lebar & tinggi genap (encoder video).
    c.width = Math.round((p.sw * skala) / 2) * 2
    c.height = Math.round((p.sh * skala) / 2) * 2
    const ctx = c.getContext('2d')
    if (!ctx) return
    let jalan = true
    const gambar = () => {
      if (!jalan) return
      ctx.drawImage(v, p.sx, p.sy, p.sw, p.sh, 0, 0, c.width, c.height)
      capFoto(ctx, c.width, c.height, [capWaktu(), spbu])
      requestAnimationFrame(gambar)
    }
    gambar()
    const rec = new MediaRecorder(c.captureStream(24), { mimeType: fmtVideo, videoBitsPerSecond: 1_200_000 })
    const potong: Blob[] = []
    const waktu = capWaktu()
    rec.ondataavailable = (e) => e.data.size && potong.push(e.data)
    rec.onstop = () => {
      jalan = false
      clearInterval(hitung)
      setDetik(null)
      rekamRef.current = null
      const blob = new Blob(potong, { type: fmtVideo.split(';')[0] })
      c.width = 0
      if (!blob.size) return setError('Video kosong, coba rekam lagi.')
      if (blob.size > MAKS_BYTE) return setError('Video terlalu besar (maks. 8 MB). Rekam lebih singkat.')
      tambah({ id: genId('m'), jenis: 'video', blob, url: URL.createObjectURL(blob), waktu })
    }
    let s = 0
    setDetik(0)
    const hitung = setInterval(() => {
      s++
      setDetik(s)
      if (s >= MAKS_DETIK) stop()
    }, 1000)
    const stop = () => rec.state !== 'inactive' && rec.stop()
    rekamRef.current = { rec, stop }
    rec.start(1000)
  }

  /** Cadangan bila kamera di halaman tidak dapat dibuka: kamera bawaan HP. */
  const dariFile = async (files: File[]) => {
    for (const f of files) {
      try {
        const waktu = capWaktu(new Date(f.lastModified || Date.now()))
        if (f.type.startsWith('video/')) {
          if (adaVideo || media.some((m) => m.jenis === 'video')) continue
          if (f.size > MAKS_BYTE) {
            setError('Video terlalu besar (maks. 8 MB). Rekam lebih singkat.')
            continue
          }
          tambah({ id: genId('m'), jenis: 'video', blob: f, url: URL.createObjectURL(f), waktu })
        } else {
          const blob = await compressImage(f, { maxSize: 1600, quality: 0.82, cap: [waktu, spbu] })
          tambah({ id: genId('m'), jenis: 'foto', blob, url: URL.createObjectURL(blob), waktu })
        }
      } catch (e) {
        setError(`Gagal memproses berkas: ${pesan(e)}`)
      }
    }
  }

  const pilih = (j: JenisInsiden) => {
    titipMedia(media)
    navigate(`/insiden/baru/${j}?dari=lapor`)
  }

  if (langkah === 'jenis')
    return (
      <div className="flex flex-col gap-space-md">
        <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
          <span className="text-tag uppercase text-primary">Langkah 2 · Pilih jenis laporan</span>
          <span className="text-body-sm text-on-surface-variant">
            {media.length ? `${nFoto} foto${adaVideo ? ' + 1 video' : ''} bercap waktu akan dilampirkan.` : 'Tanpa foto/video.'}
          </span>
          {media.length > 0 && (
            <div className="flex gap-space-xs overflow-x-auto">
              {media.map((m) =>
                m.jenis === 'foto' ? <img key={m.id} src={m.url} alt="Foto bercap waktu" className="size-16 shrink-0 rounded-md object-cover" /> : <video key={m.id} src={m.url} muted playsInline className="size-16 shrink-0 rounded-md bg-black object-cover" />,
              )}
            </div>
          )}
        </GlassCard>
        <nav aria-label="Jenis laporan" className="animate-entrance-2 flex flex-col gap-space-sm">
          <button
            type="button"
            onClick={() => {
              titipMedia(media)
              navigate('/stop-penyaluran/baru?dari=lapor')
            }}
            className="flex min-h-16 items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md text-left shadow-sm ring-1 ring-error/30 active:bg-surface-container-low"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-md font-bold text-error">Lapor {JENIS_HENTI.label.toLowerCase()}</span>
              <span className="text-body-sm text-on-surface-variant">{JENIS_HENTI.desc}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
          </button>
          {JENIS_INSIDEN.map((j) => (
            <button key={j.value} type="button" onClick={() => pilih(j.value)} className="flex min-h-16 items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md text-left shadow-sm active:bg-surface-container-low">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-bold text-on-surface">Lapor {j.label.toLowerCase()}</span>
                <span className="text-body-sm text-on-surface-variant">{j.desc}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
            </button>
          ))}
        </nav>
        <Button variant="glass" onClick={() => setLangkah('kamera')}>
          <Camera aria-hidden="true" />
          Kembali ke kamera
        </Button>
      </div>
    )

  const merekam = detik !== null
  return (
    <div className="flex flex-col gap-space-sm">
      {/* Lebar mengikuti tinggi maksimal supaya rasio 3:4 tetap & kotak selalu di tengah layar. */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[calc(56dvh*3/4)] overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Pratinjau kamera" className="size-full object-cover" />
        {siap && !error && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {[1, 2].map((i) => (
              <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/55 shadow-[0_0_1px_rgba(0,0,0,0.6)]" style={{ left: `${(i * 100) / 3}%` }} />
            ))}
            {[1, 2].map((i) => (
              <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/55 shadow-[0_0_1px_rgba(0,0,0,0.6)]" style={{ top: `${(i * 100) / 3}%` }} />
            ))}
            <span className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute inset-x-0 top-1/2 h-px bg-white/80" />
              <span className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
            </span>
          </div>
        )}
        {kilat && <div aria-hidden="true" className="absolute inset-0 bg-white/80" />}
        {!error && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2">
            <span className="tabular block text-[15px] font-bold text-[#ffd54f]">{jam}</span>
            <span className="block text-[13px] font-medium text-white">{spbu}</span>
          </div>
        )}
        {merekam && (
          <span role="status" className="tabular absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-error px-2.5 py-1 text-body-sm font-bold text-on-error">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            REC {String(Math.floor(detik / 60)).padStart(2, '0')}:{String(detik % 60).padStart(2, '0')} / 00:{MAKS_DETIK}
          </span>
        )}
        {!siap && !error && <span className="absolute inset-0 flex items-center justify-center text-body-sm font-semibold text-white">Membuka kamera…</span>}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-space-sm p-space-md text-center">
            <span className="text-body-sm font-semibold text-white">{error}</span>
            <Button variant="glass" size="sm" onClick={() => (setError(null), setCoba((c) => c + 1))}>
              <RotateCcw aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        )}
        {senter && (
          <button
            type="button"
            aria-pressed={senter.on}
            aria-label={senter.on ? 'Matikan senter' : 'Nyalakan senter'}
            onClick={() => senter.set(!senter.on)}
            className={cn('absolute right-3 top-3 flex size-11 items-center justify-center rounded-full', senter.on ? 'bg-amber-300 text-black' : 'bg-black/50 text-white')}
          >
            <Flashlight aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Mode kamera" className="flex justify-center gap-space-xs">
        {(
          [
            ['foto', 'Foto', Camera],
            ['video', 'Video', Video],
          ] as const
        ).map(([k, l, Ikon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            disabled={merekam}
            onClick={() => setMode(k)}
            className={cn('flex min-h-10 items-center gap-1.5 rounded-full px-4 text-body-sm font-semibold', mode === k ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant')}
          >
            <Ikon aria-hidden="true" className="size-4" />
            {l}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-space-sm px-space-xs">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={merekam} aria-label="Ambil dari kamera HP / galeri" className="flex size-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-sm">
          <ImagePlus aria-hidden="true" className="size-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const f = [...(e.target.files ?? [])]
            e.target.value = ''
            void dariFile(f)
          }}
        />
        {mode === 'foto' ? (
          <button type="button" aria-label="Ambil foto" disabled={!siap || nFoto >= MAKS_FOTO} onClick={() => void foto()} className="flex size-[72px] items-center justify-center rounded-full border-4 border-primary bg-surface-container-lowest disabled:opacity-40">
            <span className="size-14 rounded-full bg-primary" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={merekam ? 'Hentikan rekaman' : 'Mulai rekam video'}
            disabled={!siap || !fmtVideo || (adaVideo && !merekam)}
            onClick={() => (merekam ? rekamRef.current?.stop() : mulaiRekam())}
            className="flex size-[72px] items-center justify-center rounded-full border-4 border-error bg-surface-container-lowest disabled:opacity-40"
          >
            {merekam ? <Square aria-hidden="true" className="size-7 fill-error text-error" /> : <span className="size-14 rounded-full bg-error" />}
          </button>
        )}
        <span className="w-12 text-center text-xs text-on-surface-variant">
          {nFoto}/{MAKS_FOTO} foto{adaVideo ? ' · 1 video' : ''}
        </span>
      </div>
      <span className="px-space-xs text-center text-body-sm text-on-surface-variant">
        {mode === 'foto' ? `Maks. ${MAKS_FOTO} foto.` : fmtVideo ? `Maks. 1 video ${MAKS_DETIK} detik (tanpa suara).` : 'Perekam video tidak didukung browser ini; pakai tombol galeri.'} Cap tanggal, jam & SPBU tertulis otomatis.
      </span>

      {media.length > 0 && (
        <div className="flex gap-space-xs overflow-x-auto px-space-xs pt-1">
          {media.map((m) => (
            <span key={m.id} className="relative shrink-0">
              {m.jenis === 'foto' ? <img src={m.url} alt={`Foto ${m.waktu}`} className="size-20 rounded-md object-cover" /> : <video src={m.url} muted playsInline className="size-20 rounded-md bg-black object-cover" />}
              {m.jenis === 'video' && <Video aria-hidden="true" className="absolute bottom-1 left-1 size-4 text-white drop-shadow" />}
              <button type="button" aria-label="Hapus" onClick={() => hapus(m.id)} className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-on-surface text-surface">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Button size="lg" disabled={merekam} onClick={() => setLangkah('jenis')}>
        {media.length ? `Lanjut · ${media.length} lampiran` : 'Lanjut tanpa foto'}
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  )
}
