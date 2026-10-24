/**
 * Pemeriksaan harian (water content tangki, kualitas harian): sekali sehari di shift 1, paling lambat
 * pukul 10:00 waktu setempat. Disimpan sebagai catatan shift 1 tanggal itu.
 */
import { todayIso } from '@/lib/date'
import type { StatusIsi } from '@/lib/status-isi'

export const BATAS_HARIAN = '10:00'

const jamKini = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** Hijau sudah; oranye hari ini sebelum batas; merah lewat batas / hari lalu; abu hari depan. */
export function statusHarian(tanggal: string, sudah: boolean, now = new Date()): StatusIsi {
  if (sudah) return 'sudah'
  const hariIni = todayIso(now)
  if (tanggal > hariIni) return 'nanti'
  return tanggal === hariIni && jamKini(now) <= BATAS_HARIAN ? 'belum' : 'terlewat'
}

/** Pengisian setelah batas (dicatat "terlambat" pada laporan). */
export const lewatBatas = (jam: string) => jam > BATAS_HARIAN
