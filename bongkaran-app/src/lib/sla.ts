/**
 * SLA pengiriman: lama dari permintaan MS2 sampai bongkar selesai, dan dari
 * gate out depot sampai bongkar selesai. Dalam menit; null bila data belum lengkap.
 */
import type { Plan, ReportSummary } from '@/lib/sop'

const waktu = (tanggal?: string, jam?: string) => {
  if (!tanggal || !jam) return null
  const t = new Date(`${tanggal}T${jam}:00`).getTime()
  return Number.isFinite(t) ? t : null
}

/** Bongkar selesai; lewat tengah malam bila jam selesai lebih kecil dari jam datang. */
export function selesaiBongkar(r: Pick<ReportSummary, 'tanggal' | 'jam' | 'jamSelesai'>) {
  const t = waktu(r.tanggal, r.jamSelesai)
  if (t === null) return null
  return r.jamSelesai && r.jam && r.jamSelesai < r.jam ? t + 86_400_000 : t
}

const menit = (a: number | null, b: number | null) => (a !== null && b !== null && b >= a ? Math.round((b - a) / 60000) : null)

export function slaOf(r: ReportSummary, plans: Plan[]) {
  const plan = r.planId ? plans.find((p) => p.id === r.planId) : undefined
  const selesai = selesaiBongkar(r)
  return {
    permintaan: menit(waktu(plan?.ms2Tanggal, plan?.ms2Jam), selesai),
    perjalanan: menit(waktu(r.tanggalKeluar, r.jamKeluar), selesai),
  }
}

/** "1 hari 2 jam", "5 jam 20 mnt", "45 mnt". */
export function formatDurasi(m: number | null | undefined) {
  if (m === null || m === undefined) return '-'
  const hari = Math.floor(m / 1440)
  const jam = Math.floor((m % 1440) / 60)
  const mnt = m % 60
  if (hari) return `${hari} hari ${jam} jam`
  if (jam) return `${jam} jam${mnt ? ` ${mnt} mnt` : ''}`
  return `${mnt} mnt`
}

export function rataRata(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}
