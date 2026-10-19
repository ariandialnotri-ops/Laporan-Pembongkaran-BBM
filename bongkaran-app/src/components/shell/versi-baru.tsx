import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const BUNDEL = /\/assets\/index-[\w-]+\.js/

/** Berkas JS utama yang sedang berjalan (nama berisi hash, berubah setiap rilis). */
const bundelSekarang = () => {
  const src = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src).find((s) => BUNDEL.test(s))
  return src?.match(BUNDEL)?.[0] ?? null
}

/**
 * Pemberitahuan rilis baru. Aplikasi yang dipasang di layar utama iPhone/Android tetap menjalankan
 * versi lama sampai benar-benar ditutup; di sini index.html diperiksa saat aplikasi kembali dibuka
 * dan tiap 5 menit, lalu pengguna diminta memuat ulang (bukan otomatis agar isian form tidak hilang).
 */
export function VersiBaru() {
  const [baru, setBaru] = useState(false)

  useEffect(() => {
    const kini = bundelSekarang()
    if (!import.meta.env.PROD || !kini) return
    let batal = false
    const cek = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const html = await (await fetch(`/?versi=${Date.now()}`, { cache: 'no-store' })).text()
        const terbaru = html.match(BUNDEL)?.[0]
        if (!batal && terbaru && terbaru !== kini) setBaru(true)
      } catch {
        /* luring: periksa lagi nanti */
      }
    }
    void cek()
    const t = window.setInterval(() => void cek(), 5 * 60_000)
    document.addEventListener('visibilitychange', cek)
    window.addEventListener('focus', cek)
    return () => {
      batal = true
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', cek)
      window.removeEventListener('focus', cek)
    }
  }, [])

  if (!baru) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-margin print:hidden lg:bottom-6">
      <div className="flex w-full max-w-md items-center gap-space-sm rounded-lg bg-inverse-surface px-space-md py-space-sm text-inverse-on-surface shadow-lg">
        <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 text-body-sm">Versi baru FLOQ tersedia.</span>
        <button type="button" onClick={() => window.location.reload()} className="touch-44 shrink-0 rounded-md bg-primary px-space-sm py-1.5 text-body-sm font-semibold text-on-primary">
          Muat ulang
        </button>
      </div>
    </div>
  )
}
