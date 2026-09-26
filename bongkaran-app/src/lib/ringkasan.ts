import { produkList, type CalendarDay, type ProductStatus } from '@/data/mock'
import { labelQQ } from '@/lib/qq'
import { addDays, hariSingkat, sameDay, startOfWeek } from '@/lib/date'
import type { Bongkaran } from '@/lib/types'

/** Today's totals from a newest-first list of unloadings. */
export function ringkasHariIni(rows: Bongkaran[], now = new Date()) {
  const today = rows.filter((r) => sameDay(new Date(r.waktu_bongkar), now))
  const selesai = today.filter((r) => r.tahap === 'selesai')
  return {
    totalLiter: today.reduce((sum, r) => sum + Number(r.volume_realisasi), 0),
    mobilTangki: today.length,
    spbu: new Set(today.map((r) => r.spbu)).size,
    qqSesuai: selesai.filter((r) => r.qq_status === 'sesuai').length,
    qqTotal: today.length,
  }
}

/** Latest verdict per product within `rows` (already limited to the period). */
export function statusProduk(rows: Bongkaran[]): ProductStatus[] {
  return produkList.map((p) => {
    const last = rows.find((r) => r.produk === p.name)
    if (!last) return { id: p.id, name: p.name, status: 'belum', note: 'Belum Input' }
    return {
      id: p.id,
      name: p.name,
      status: last.qq_status,
      note: last.qq_status === 'sesuai' ? 'Sesuai' : labelQQ(last),
    }
  })
}

/** Monday–Sunday strip: green when every record that day is sesuai, red when any needs attention. */
export function kalenderMinggu(rows: Bongkaran[], now = new Date()): CalendarDay[] {
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const onDay = rows.filter((r) => sameDay(new Date(r.waktu_bongkar), day))
    let status: CalendarDay['status'] = 'belum'
    if (onDay.some((r) => r.qq_status === 'perhatian')) status = 'catatan'
    else if (onDay.length > 0 && onDay.every((r) => r.qq_status === 'sesuai')) status = 'sesuai'
    else if (onDay.length > 0) status = 'catatan'
    return { label: hariSingkat(day), date: day.getDate(), status, isToday: sameDay(day, now) }
  })
}
