/**
 * Guard Tour System (GTS): sampling subsidi tepat oleh security. Hari operasional (06:00-05:59) dibagi
 * 12 slot 2 jam; tiap slot minimal 1 transaksi JBT (Biosolar) dan 1 JBKP (Pertalite), masing-masing
 * dengan foto EDC, struk, dan kendaraan dengan nomor polisi terlihat.
 */
import { addDays, todayIso } from '@/lib/date'
import type { Photo } from '@/lib/sop'
import type { StatusIsi } from '@/lib/status-isi'

export type JenisGts = 'JBT' | 'JBKP'
export const JENIS_GTS: { value: JenisGts; label: string; produk: string; desc: string }[] = [
  { value: 'JBT', label: 'JBT', produk: 'Biosolar', desc: 'Jenis BBM Tertentu (solar subsidi)' },
  { value: 'JBKP', label: 'JBKP', produk: 'Pertalite', desc: 'Jenis BBM Khusus Penugasan' },
]
export const jenisGts = (j: JenisGts) => JENIS_GTS.find((x) => x.value === j)!

export type FotoGtsKey = 'edc' | 'struk' | 'kendaraan'
export const FOTO_GTS: { key: FotoGtsKey; label: string; hint: string }[] = [
  { key: 'edc', label: 'Foto EDC', hint: 'Layar mesin EDC saat transaksi (QR/MyPertamina).' },
  { key: 'struk', label: 'Foto struk', hint: 'Struk transaksi terbaca: produk, liter, harga.' },
  { key: 'kendaraan', label: 'Foto kendaraan', hint: 'Kendaraan di depan dispenser, nomor polisi terlihat jelas.' },
]

export interface GtsData {
  nopol: string
  produk: string
  liter: string
  jam: string
  petugas: string
  catatan: string
  foto: Record<FotoGtsKey, Photo[]>
}

export interface GtsRecord {
  id: string
  tanggal: string
  /** 0 = 06:00-07:59 ... 11 = 04:00-05:59. */
  slot: number
  jenis: JenisGts
  data: GtsData
  createdAt: number
  createdBy: string | null
}

export const JUMLAH_SLOT = 12
const pad = (n: number) => String(n).padStart(2, '0')
/** Jam mulai slot (06, 08, ..., 04). */
export const jamMulaiSlot = (slot: number) => (6 + slot * 2) % 24
export const labelSlot = (slot: number) => `${pad(jamMulaiSlot(slot))}:00 - ${pad((jamMulaiSlot(slot) + 1) % 24)}:59`

/** Slot berjalan & tanggal operasionalnya (00:00-05:59 masih hari operasional sebelumnya). */
export function slotKini(now = new Date()) {
  const h = now.getHours()
  const tanggal = h < 6 ? todayIso(addDays(now, -1)) : todayIso(now)
  return { tanggal, slot: Math.floor((((h - 6) % 24) + 24) % 24 / 2) }
}

/** Status slot: hijau = JBT & JBKP lengkap, oranye = slot berjalan belum lengkap, merah = slot lewat belum lengkap. */
export function statusSlot(tanggal: string, slot: number, recs: GtsRecord[], now = slotKini()): StatusIsi {
  const isi = recs.filter((r) => r.tanggal === tanggal && r.slot === slot)
  if (isi.some((r) => r.jenis === 'JBT') && isi.some((r) => r.jenis === 'JBKP')) return 'sudah'
  const a = `${tanggal}#${pad(slot)}`
  const b = `${now.tanggal}#${pad(now.slot)}`
  return a < b ? 'terlewat' : a === b ? 'belum' : 'nanti'
}

export const gtsId = () => `gts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
