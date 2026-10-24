import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Jarak tarik (px, setelah redaman) yang memicu penyegaran. */
export const AMBANG = 64
const MAKS = 96

/**
 * Tarik untuk segarkan (gaya aplikasi HP): di puncak halaman, tarik ke bawah lalu lepas.
 * `segarkan` memuat ulang data; bila tidak ada isian yang sudah diubah di halaman, isi halaman
 * juga dipasang ulang (`kunci` berganti) sehingga setiap halaman memuat ulang datanya sendiri.
 * Isian yang belum disimpan tidak pernah dibuang: halaman dengan isian berubah hanya memuat ulang data bersama.
 */
export function usePullSegarkan(segarkan: () => Promise<unknown>) {
  const { pathname } = useLocation()
  const [tarik, setTarik] = useState(0)
  const [sibuk, setSibuk] = useState(false)
  const [kunci, setKunci] = useState(0)
  const diubah = useRef(false)
  const sibukRef = useRef(false)
  const fn = useRef(segarkan)
  useEffect(() => {
    fn.current = segarkan
  })

  // Isian berubah di halaman ini → jangan pasang ulang (agar ketikan tidak hilang).
  useEffect(() => {
    diubah.current = false
    const tandai = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest('#konten')) diubah.current = true
    }
    document.addEventListener('input', tandai, true)
    document.addEventListener('change', tandai, true)
    return () => {
      document.removeEventListener('input', tandai, true)
      document.removeEventListener('change', tandai, true)
    }
  }, [pathname, kunci])

  useEffect(() => {
    let y0 = 0
    let x0 = 0
    let aktif = false
    let arah: 'v' | 'h' | null = null
    let jarak = 0

    const boleh = (t: EventTarget | null) => {
      if (sibukRef.current || window.scrollY > 0) return false
      if (document.documentElement.dataset.keyboard === 'open') return false
      if (document.querySelector('[role="dialog"][data-state="open"], [role="listbox"], [role="menu"]')) return false
      const el = t as HTMLElement | null
      // Kanvas tanda tangan, slider, dan area yang menolak (mis. peta) tidak memicu tarik.
      if (el?.closest('canvas, input[type="range"], [data-tanpa-tarik], [role="dialog"]')) return false
      return true
    }
    const mulai = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !boleh(e.target)) return
      aktif = true
      arah = null
      jarak = 0
      y0 = e.touches[0].clientY
      x0 = e.touches[0].clientX
    }
    const gerak = (e: TouchEvent) => {
      if (!aktif) return
      const dy = e.touches[0].clientY - y0
      const dx = e.touches[0].clientX - x0
      if (!arah) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return
        arah = Math.abs(dy) > Math.abs(dx) && dy > 0 && window.scrollY <= 0 ? 'v' : 'h'
      }
      if (arah !== 'v') {
        aktif = false
        return
      }
      if (e.cancelable) e.preventDefault()
      jarak = Math.min(MAKS, Math.max(0, dy * 0.5))
      setTarik(jarak)
    }
    const lepas = async () => {
      if (!aktif) return
      aktif = false
      if (jarak < AMBANG) {
        setTarik(0)
        return
      }
      sibukRef.current = true
      setSibuk(true)
      setTarik(AMBANG)
      navigator.vibrate?.(10)
      try {
        await Promise.all([fn.current().catch(() => {}), new Promise((r) => setTimeout(r, 500))])
        if (!diubah.current) setKunci((k) => k + 1)
      } finally {
        sibukRef.current = false
        setSibuk(false)
        setTarik(0)
      }
    }
    window.addEventListener('touchstart', mulai, { passive: true })
    window.addEventListener('touchmove', gerak, { passive: false })
    window.addEventListener('touchend', lepas)
    window.addEventListener('touchcancel', lepas)
    return () => {
      window.removeEventListener('touchstart', mulai)
      window.removeEventListener('touchmove', gerak)
      window.removeEventListener('touchend', lepas)
      window.removeEventListener('touchcancel', lepas)
    }
  }, [])

  return { tarik, sibuk, kunci }
}
