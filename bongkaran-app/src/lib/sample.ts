/**
 * Uji Kualitas Pasca Penerimaan: setiap bongkaran selesai wajib diikuti uji
 * density tangki pendam. Jam uji diatur sendiri oleh petugas.
 */
import { addDays, todayIso } from '@/lib/date'
import type { ReportSummary } from '@/lib/sop'

/** Bongkaran selesai (7 hari terakhir) yang belum diuji pasca penerimaan. */
export function sampleMenunggu(reports: ReportSummary[], now = new Date()) {
  const batas = todayIso(addDays(now, -7))
  return reports
    .filter((r) => r.status === 'selesai' && !r.sample2Jam && r.tanggal >= batas)
    .map((r) => ({ r }))
    .sort((a, b) => (b.r.tanggal + b.r.jam).localeCompare(a.r.tanggal + a.r.jam))
}
