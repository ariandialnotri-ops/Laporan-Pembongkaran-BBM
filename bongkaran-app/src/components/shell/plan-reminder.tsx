import { useEffect } from 'react'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { planBesokKurang } from '@/lib/plan'

const KEY = 'floq-pengingat-plan'

/**
 * Pengingat harian pukul 06:00: bila plan pengiriman besok belum ada, kirim notifikasi perangkat
 * (bila diizinkan) sekali per hari. Di aplikasi pengingat tampil sebagai baris amber di Dashboard,
 * lencana menu Plan, dan Inbox (bukan toast yang menutupi kartu tanggal & shift).
 */
export function PlanReminder() {
  const app = useApp()
  const { loaded, plans, spbuSiap } = app

  useEffect(() => {
    // SPBU yang datanya belum lengkap belum perlu diingatkan soal plan.
    if (!loaded || !spbuSiap) return
    const cek = () => {
      const besok = planBesokKurang(plans)
      if (!besok) return
      const hari = new Date().toDateString()
      try {
        if (localStorage.getItem(KEY) === hari) return
        localStorage.setItem(KEY, hari)
      } catch {
        /* penyimpanan diblokir: tetap ingatkan */
      }
      const pesan = `Plan pengiriman untuk besok (${formatTanggalIso(besok)}) belum dibuat`
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('FLOQ: buat plan pengiriman', { body: pesan, icon: '/floq-icon-256.png', tag: 'plan-besok' })
        } catch {
          /* beberapa browser HP hanya mengizinkan notifikasi lewat service worker */
        }
      }
    }
    cek()
    const t = window.setInterval(cek, 60_000)
    return () => window.clearInterval(t)
  }, [loaded, spbuSiap, plans])

  return null
}
