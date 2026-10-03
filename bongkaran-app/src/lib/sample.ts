/**
 * Sample BBM 2 jam: bongkaran selesai yang tangki pendamnya perlu diuji
 * lagi minimal 2 jam setelah bongkar selesai.
 */
import { addDays, todayIso } from '@/lib/date'
import { SAMPLE_JEDA_MENIT, sampleJeda, type ReportSummary } from '@/lib/sop'

/** Bongkaran yang masih ditunggu sampelnya (7 hari terakhir). */
export function sampleMenunggu(reports: ReportSummary[], now = new Date()) {
  const batas = todayIso(addDays(now, -7))
  return reports
    .filter((r) => r.status === 'selesai' && !r.sample2Jam && r.tanggal >= batas)
    .map((r) => {
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const jeda = sampleJeda({ tanggalDatang: r.tanggal, jamDatang: r.jam, jamSelesaiBongkar: r.jamSelesai ?? '' }, todayIso(now), hm)
      return { r, jeda, siap: jeda === null || jeda >= SAMPLE_JEDA_MENIT }
    })
    .sort((a, b) => (b.r.tanggal + b.r.jam).localeCompare(a.r.tanggal + a.r.jam))
}

/** Jam paling cepat sampel boleh diambil (HH:MM), dari jam selesai bongkar. */
export function jamBolehSample(jamSelesai: string | undefined) {
  if (!jamSelesai) return null
  const [h, m] = jamSelesai.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const t = h * 60 + m + SAMPLE_JEDA_MENIT
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
