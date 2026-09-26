import { addDays, hariSingkat, sameDay, startOfWeek, todayIso } from '@/lib/date'
import { PRODUK_OPTIONS, type ReportSummary } from '@/lib/sop'

/** Status Q&Q di pill: sesuai (selesai), perhatian (anomali), belum (draft / belum ada). */
export type QQStatus = 'sesuai' | 'perhatian' | 'belum'

export interface CalendarDay {
  label: string
  date: number
  status: 'sesuai' | 'catatan' | 'belum'
  isToday?: boolean
}

export interface ProductStatus {
  name: string
  status: QQStatus
  note: string
}

export function qqOf(r: Pick<ReportSummary, 'status' | 'densityAnomaly'>): QQStatus {
  if (r.status === 'selesai') return 'sesuai'
  if (r.status === 'anomali' || r.densityAnomaly) return 'perhatian'
  return 'belum'
}

export function labelQQ(r: Pick<ReportSummary, 'status' | 'densityAnomaly' | 'doneCount'>, totalSteps: number) {
  if (r.status === 'selesai') return 'Q&Q Sesuai'
  if (r.status === 'anomali') return 'Anomali density'
  if (r.densityAnomaly) return 'Anomali density'
  return `Tahap ${Math.min(r.doneCount + 1, totalSteps)}/${totalSteps}`
}

/** Angka hari ini dari daftar laporan. */
export function ringkasHariIni(rows: ReportSummary[], now = new Date()) {
  const today = rows.filter((r) => r.tanggal === todayIso(now))
  const selesai = today.filter((r) => r.status === 'selesai')
  return {
    totalLiter: selesai.reduce((sum, r) => sum + (r.volumeDO ?? 0), 0),
    mobilTangki: today.length,
    gainLoss: selesai.reduce((sum, r) => sum + (r.gainLoss ?? 0), 0),
    qqSesuai: selesai.length,
    qqTotal: today.length,
    perluCek: today.filter((r) => qqOf(r) === 'perhatian'),
  }
}

/** Status terakhir per produk minggu ini. */
export function statusProduk(rows: ReportSummary[]): ProductStatus[] {
  return PRODUK_OPTIONS.map((name) => {
    const last = rows.find((r) => r.produk === name)
    if (!last) return { name, status: 'belum', note: 'Belum input' }
    const status = qqOf(last)
    return { name, status, note: status === 'sesuai' ? 'Sesuai' : status === 'perhatian' ? 'Anomali' : 'Dalam proses' }
  })
}

/** Senin–Minggu: sesuai bila ada bongkaran selesai tanpa anomali, catatan bila ada anomali. */
export function kalenderMinggu(rows: ReportSummary[], now = new Date()): CalendarDay[] {
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const onDay = rows.filter((r) => r.tanggal === todayIso(day))
    let status: CalendarDay['status'] = 'belum'
    if (onDay.some((r) => qqOf(r) === 'perhatian')) status = 'catatan'
    else if (onDay.some((r) => r.status === 'selesai')) status = 'sesuai'
    return { label: hariSingkat(day), date: day.getDate(), status, isToday: sameDay(day, now) }
  })
}
