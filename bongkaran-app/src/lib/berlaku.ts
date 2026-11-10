import { addDays, todayIso as isoOf } from '@/lib/date'

/** Tanggal + n bulan (YYYY-MM-DD); tanggal yang tidak ada di bulan tujuan memakai akhir bulan. */
export function tambahBulan(tgl: string | undefined, bulan: number) {
  if (!tgl) return ''
  const [y, m, d] = tgl.split('-').map(Number)
  const t = new Date(y, m - 1 + bulan, d)
  if (t.getDate() !== d) t.setDate(0)
  return isoOf(t)
}

/** Masa berlaku: lewat, tinggal ≤ 30 hari, atau masih berlaku; null bila tanggal kosong. */
export function statusTanggal(batas: string, todayIso: string): 'lewat' | 'segera' | 'ok' | null {
  if (!batas) return null
  if (batas < todayIso) return 'lewat'
  return batas <= isoOf(addDays(new Date(`${todayIso}T00:00:00`), 30)) ? 'segera' : 'ok'
}

/** Sertifikat berlaku maks. 12 bulan dari tanggal terbit (tera metrologi, pemeriksaan instansi). */
export const MASA_SERTIFIKAT_BULAN = 12
export const berlakuSertifikat = (tglTerbit: string | undefined) => tambahBulan(tglTerbit, MASA_SERTIFIKAT_BULAN)
export const statusSertifikat = (tglTerbit: string | undefined, todayIso: string): 'belum' | 'lewat' | 'segera' | 'ok' =>
  statusTanggal(berlakuSertifikat(tglTerbit), todayIso) ?? 'belum'
