/**
 * Personil SPBU & jadwal shift bulanan. Daftar personil disimpan di pengaturan SPBU (settings.personil);
 * jadwal satu catatan per bulan di tabel bbm_jadwal (id "YYYY-MM"): roster[personil][tanggal] = kode.
 */
import { currentShift, type Shift } from '@/lib/shift'
import type { Personil, Settings } from '@/lib/sop'

export const JABATAN = ['Pengawas', 'Kepala Shift', 'Operator', 'Kasir', 'Admin / Cashier', 'Security', 'Cleaning Service', 'Teknisi', 'Lainnya']

/** Kode sel jadwal: shift 1-3, L = libur, C = cuti, I = izin/sakit. */
export type KodeJadwal = '1' | '2' | '3' | 'L' | 'C' | 'I'
export const KODE_JADWAL: { kode: KodeJadwal; label: string; kelas: string }[] = [
  { kode: '1', label: 'Shift 1', kelas: 'bg-sky-100 text-sky-800' },
  { kode: '2', label: 'Shift 2', kelas: 'bg-amber-100 text-amber-800' },
  { kode: '3', label: 'Shift 3', kelas: 'bg-indigo-100 text-indigo-800' },
  { kode: 'L', label: 'Libur', kelas: 'bg-surface-container-high text-on-surface-variant' },
  { kode: 'C', label: 'Cuti', kelas: 'bg-emerald-100 text-emerald-800' },
  { kode: 'I', label: 'Izin / sakit', kelas: 'bg-red-100 text-red-800' },
]
export const kodeInfo = (k?: string) => KODE_JADWAL.find((x) => x.kode === k)

export interface JadwalData {
  /** roster[personilId][tanggal 1-31] = kode */
  roster: Record<string, Record<string, KodeJadwal>>
}

export const personilAktif = (s: Pick<Settings, 'personil'>) => (s.personil ?? []).filter((p) => p.aktif)
export const personilId = () => `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

/** Personil terjadwal pada shift `shift` tanggal operasional `tanggal`. */
export function bertugas(s: Pick<Settings, 'personil'>, jadwal: JadwalData | null | undefined, tanggal: string, shift: Shift): Personil[] {
  if (!jadwal) return []
  const hari = String(Number(tanggal.slice(8)))
  return (s.personil ?? []).filter((p) => jadwal.roster[p.id]?.[hari] === String(shift))
}

/** Shift berjalan sekarang & bulan jadwal yang memuatnya. */
export function shiftSekarang(now = new Date()) {
  const k = currentShift(now)
  return { ...k, bulan: k.tanggal.slice(0, 7) }
}
