/**
 * Water content tangki pendam: pengecekan air dengan pasta air pada stik ukur di setiap tangki,
 * satu catatan per tanggal & shift berisi semua tangki. Air wajib nihil (0 mm); bila ada air,
 * tindakan (pengurasan/penyedotan, lapor pengawas) wajib dicatat. Disimpan di tabel bbm_air.
 */
import { parseAngka } from '@/lib/format'
import type { Shift } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { volumeTank, type Tank } from '@/lib/tank'

export interface AirTangki {
  /** Tinggi air di dasar tangki (mm); "0" = nihil. */
  airMm: string
  /** Volume air dari tabel kalibrasi tangki (liter), bila tinggi air masuk rentang tabel. */
  liter: number | null
  /** Foto stik ukur dengan pasta air. */
  foto: Photo[]
  /** Wajib bila ada air. */
  tindakan: string
}

export interface AirData {
  /** Per id tangki. */
  tangki: Record<string, AirTangki>
  petugas: string
  jam: string
  catatan: string
}

export interface AirRecord {
  /** `${tanggal}_${shift}`. */
  id: string
  tanggal: string
  shift: Shift
  data: AirData
  createdAt: number
  updatedAt: number
  createdBy: string | null
}

export const airId = (tanggal: string, shift: Shift) => `${tanggal}_${shift}`

/** Status satu tangki: belum diisi, nihil (0 mm), atau ada air. */
export type StatusAir = 'kosong' | 'nihil' | 'ada'
export function statusAir(t: AirTangki | undefined): StatusAir {
  const mm = parseAngka(t?.airMm ?? '')
  if (mm === null) return 'kosong'
  return mm > 0 ? 'ada' : 'nihil'
}

/** Volume air (liter) dari tabel kalibrasi; null bila di luar rentang tabel atau 0 mm. */
export function literAir(tank: Tank | undefined, airMm: string) {
  const mm = parseAngka(airMm)
  if (!tank || mm === null || mm <= 0) return mm === 0 ? 0 : null
  const v = volumeTank(tank, mm)
  return v.error === undefined ? v.volume : null
}

/** Semua tangki terisi (dan berfoto) pada catatan ini. */
export const airLengkap = (r: AirRecord | undefined, tanks: Tank[]) => !!r && tanks.every((t) => statusAir(r.data.tangki[t.id]) !== 'kosong' && (r.data.tangki[t.id]?.foto.length ?? 0) > 0)

/** Tangki yang ada airnya pada catatan ini. */
export const tangkiBerair = (r: AirRecord | undefined, tanks: Tank[]) => (r ? tanks.filter((t) => statusAir(r.data.tangki[t.id]) === 'ada') : [])
