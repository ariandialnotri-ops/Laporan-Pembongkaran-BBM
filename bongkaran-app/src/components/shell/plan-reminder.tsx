import { useEffect } from 'react'
import { CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { planBesokKurang } from '@/lib/plan'

const KEY = 'floq-pengingat-plan'

/**
 * Pengingat harian pukul 06:00: bila plan pengiriman besok belum ada, tampilkan
 * toast (dan notifikasi perangkat bila diizinkan), sekali per hari. Diperiksa tiap
 * menit selama aplikasi terbuka; ringan untuk HP spesifikasi rendah.
 */
export function PlanReminder() {
  const app = useApp()
  const toast = useToast()
  const { loaded, plans } = app

  useEffect(() => {
    if (!loaded) return
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
      toast(pesan, CalendarClock)
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
  }, [loaded, plans, toast])

  return null
}
