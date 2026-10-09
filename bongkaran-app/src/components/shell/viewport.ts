import { useEffect } from 'react'

/**
 * Ukuran layar yang benar-benar terlihat (visual viewport), untuk iPhone/Safari:
 * - `--vvh`: tinggi area terlihat (mengecil saat keyboard muncul).
 * - `--kb`: tinggi keyboard di bawah area terlihat; bottom sheet naik setinggi ini.
 * - `html[data-keyboard="open"]`: dock disembunyikan selama keyboard tampil.
 * Saat keyboard ditutup, posisi elemen `fixed` dihitung ulang agar dock tidak "hilang".
 */
export function useViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let terbuka = false
    let raf = 0
    const ukur = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const tinggi = vv ? vv.height : window.innerHeight
        const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
        root.style.setProperty('--vvh', `${Math.round(tinggi)}px`)
        root.style.setProperty('--kb', `${kb}px`)
        const buka = kb > 120
        if (buka !== terbuka) {
          terbuka = buka
          if (buka) root.dataset.keyboard = 'open'
          else {
            delete root.dataset.keyboard
            // iOS kadang menyisakan geseran layout setelah keyboard tertutup.
            window.scrollTo(window.scrollX, window.scrollY)
          }
        }
      })
    }
    ukur()
    vv?.addEventListener('resize', ukur)
    vv?.addEventListener('scroll', ukur)
    window.addEventListener('resize', ukur)
    window.addEventListener('orientationchange', ukur)
    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', ukur)
      vv?.removeEventListener('scroll', ukur)
      window.removeEventListener('resize', ukur)
      window.removeEventListener('orientationchange', ukur)
    }
  }, [])
}

/**
 * Pengaman kunci gulir: Radix (sheet, pilihan) mengunci gulir body selama terbuka.
 * Bila halaman berganti saat sheet masih menutup, kunci bisa tertinggal sehingga
 * halaman tidak bisa digulir. Lepaskan bila tidak ada dialog/menu yang terbuka.
 */
export function lepasKunciGulir() {
  window.setTimeout(() => {
    if (document.querySelector('[role="dialog"][data-state="open"], [role="listbox"]')) return
    const b = document.body
    if (b.hasAttribute('data-scroll-locked')) b.removeAttribute('data-scroll-locked')
    if (b.style.pointerEvents === 'none') b.style.pointerEvents = ''
    if (b.style.overflow === 'hidden') b.style.overflow = ''
  }, 400)
}
