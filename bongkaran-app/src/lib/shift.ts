import { addDays, todayIso } from '@/lib/date'

/** Shift operasional SPBU. Shift 3 melewati tengah malam. */
export type Shift = 1 | 2 | 3

export const SHIFTS: { no: Shift; label: string; jam: string }[] = [
  { no: 1, label: 'Shift 1', jam: '06:00 - 13:59' },
  { no: 2, label: 'Shift 2', jam: '14:00 - 21:59' },
  { no: 3, label: 'Shift 3', jam: '22:00 - 05:59' },
]

export function shiftLabel(no: Shift | null | undefined) {
  const s = SHIFTS.find((x) => x.no === no)
  return s ? `${s.label} (${s.jam})` : '-'
}

/** Shift dari jam "HH:MM". */
export function shiftOfHm(hm: string): Shift | null {
  const [h, m] = (hm || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h >= 6 && h < 14) return 1
  if (h >= 14 && h < 22) return 2
  return 3
}

/**
 * Shift dan tanggal operasional. Jam 00:00 - 05:59 masih shift 3 dari
 * tanggal sebelumnya, sehingga satu shift tidak terbelah dua tanggal.
 */
export function shiftKey(tanggalIso: string, hm: string): { tanggal: string; shift: Shift } | null {
  const shift = shiftOfHm(hm)
  if (!shift || !tanggalIso) return null
  const h = Number(hm.split(':')[0])
  if (shift === 3 && h < 6) return { tanggal: todayIso(addDays(new Date(`${tanggalIso}T00:00:00`), -1)), shift }
  return { tanggal: tanggalIso, shift }
}

/** Shift yang sedang berjalan sekarang. */
export function currentShift(now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return shiftKey(todayIso(now), hm)!
}

export function nextShift(k: { tanggal: string; shift: Shift }): { tanggal: string; shift: Shift } {
  if (k.shift < 3) return { tanggal: k.tanggal, shift: (k.shift + 1) as Shift }
  return { tanggal: todayIso(addDays(new Date(`${k.tanggal}T00:00:00`), 1)), shift: 1 }
}

export const shiftId = (k: { tanggal: string; shift: Shift }) => `${k.tanggal}#${k.shift}`
