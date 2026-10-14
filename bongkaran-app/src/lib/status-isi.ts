import { currentShift, type Shift } from '@/lib/shift'

/**
 * Status pengisian di menu input: hijau = sudah diisi, oranye = belum, merah = terlewat pengisian,
 * abu-abu = belum waktunya.
 */
export type StatusIsi = 'sudah' | 'belum' | 'terlewat' | 'nanti'

/** Status satu shift: lewat dari shift berjalan tanpa data = terlewat; shift berikutnya = belum waktunya. */
export function statusShift(k: { tanggal: string; shift: Shift }, sudah: boolean, now = currentShift()): StatusIsi {
  if (sudah) return 'sudah'
  const a = `${k.tanggal}#${k.shift}`
  const b = `${now.tanggal}#${now.shift}`
  return a < b ? 'terlewat' : a === b ? 'belum' : 'nanti'
}
