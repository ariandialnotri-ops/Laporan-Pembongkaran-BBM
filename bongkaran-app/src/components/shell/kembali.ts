import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '@/lib/app-state'
import { parentOf, turunanDari } from '@/lib/nav'
import { berandaPeran } from '@/lib/roles'

/** Jalur halaman per indeks riwayat browser (sesi ini), supaya "kembali" tidak membuka halaman Terkirim lagi. */
const jejak = new Map<number, string>()
/** Indeks riwayat yang berisi form (berpenjaga): tombol kembali tidak membuka lagi form yang sudah ditinggalkan. */
const jejakForm = new Map<number, string>()
const idxSekarang = () => (window.history.state as { idx?: number } | null)?.idx ?? 0

/** Catat jalur tiap halaman yang dibuka (dipanggil sekali di AppShell). */
export function useCatatJejak() {
  const { pathname, key } = useLocation()
  useEffect(() => {
    jejak.set(idxSekarang(), pathname)
  }, [pathname, key])
}

/** Dipanggil form yang memakai konfirmasi keluar (useLeaveGuard). */
export function tandaiForm(pathname: string) {
  jejakForm.set(idxSekarang(), pathname)
}

/**
 * Tujuan tombol kembali: halaman sebelumnya bila itu memang halaman asal (mis. Riwayat), selain itu
 * menu induk. Halaman grup (Operation, Delivery, ...) kembali ke Dashboard, atau ke beranda peran
 * yang tidak punya Dashboard. null = halaman beranda, tanpa tombol kembali.
 */
export function useKembali() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const app = useApp()
  let parent = parentOf(pathname)
  if (parent === '/' && !app.can('/')) parent = berandaPeran(app.role)
  if (parent === pathname) parent = null
  const kembali = useCallback(() => {
    if (!parent) return
    const idx = idxSekarang()
    const sebelum = jejak.get(idx - 1)
    // Halaman sebelumnya yang merupakan turunan halaman ini (form/detail yang baru ditutup) tidak
    // dibuka lagi: kembali ke menu induk supaya tidak bolak-balik daftar ↔ form.
    // Form yang sudah ditinggalkan juga tidak dibuka lagi.
    const bolehMundur = idx > 0 && sebelum && sebelum !== '/terkirim' && sebelum !== pathname && !turunanDari(sebelum, pathname) && jejakForm.get(idx - 1) !== sebelum
    if (bolehMundur) navigate(-1)
    else navigate(parent, { replace: true })
  }, [navigate, parent, pathname])
  return parent ? kembali : null
}

/**
 * Aplikasi yang dipasang di layar utama iPhone tidak punya gerakan "kembali" bawaan Safari:
 * geser dari tepi kiri layar menjalankan tombol kembali (konfirmasi form tetap muncul).
 * Di Safari biasa dan Android, gerakan tepi kiri sudah dipakai sistem untuk kembali, jadi tidak diganggu.
 */
export function useGeserKembali(kembali: (() => void) | null) {
  useEffect(() => {
    const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (!standaloneIos || !kembali) return
    let a: { x: number; y: number } | null = null
    const mulai = (e: TouchEvent) => {
      const t = e.touches[0]
      a = t.clientX <= 20 && !document.querySelector('[role="dialog"][data-state="open"], [role="listbox"]') ? { x: t.clientX, y: t.clientY } : null
    }
    const gerak = (e: TouchEvent) => {
      if (!a) return
      const t = e.touches[0]
      const dx = t.clientX - a.x
      if (dx > 70 && dx > Math.abs(t.clientY - a.y) * 1.5) {
        a = null
        kembali()
      }
    }
    const lepas = () => (a = null)
    window.addEventListener('touchstart', mulai, { passive: true })
    window.addEventListener('touchmove', gerak, { passive: true })
    window.addEventListener('touchend', lepas, { passive: true })
    window.addEventListener('touchcancel', lepas, { passive: true })
    return () => {
      window.removeEventListener('touchstart', mulai)
      window.removeEventListener('touchmove', gerak)
      window.removeEventListener('touchend', lepas)
      window.removeEventListener('touchcancel', lepas)
    }
  }, [kembali])
}
