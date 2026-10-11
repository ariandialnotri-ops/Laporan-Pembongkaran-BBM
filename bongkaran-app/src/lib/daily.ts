/**
 * Catatan harian per shift: stok awal tiap produk (wajib setiap awal shift)
 * dan uji Q&Q harian (kualitas density, kuantitas bejana 20 liter).
 */
import { density15, normalizeDensity, type Density15 } from '@/lib/density'
import { parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import type { Shift } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import type { AparData } from '@/lib/apar'
import type { InsidenData } from '@/lib/insiden'
import type { TakarData } from '@/lib/takar'

export interface StokItem {
  /** Ketinggian ATG/deepstick (mm). */
  tinggi: string
  /** Volume stok awal (L). */
  volume: string
  /** Pengeluaran dispenser selama shift (L), diisi di akhir shift. */
  pengeluaran: string
}

export interface StokData {
  petugas: string
  /** Per produk. */
  items: Record<string, StokItem>
  catatan: string
}

export interface QqKualitas {
  id: string
  produk: string
  densityObs: string
  suhu: string
  /** Volume pump test untuk sampel uji kualitas (L). */
  pumpTest: string
  /** Waktu baris ini terakhir disimpan; kosong bila belum/berubah setelah disimpan. */
  savedAt?: string
}

export interface QqKuantitas {
  id: string
  nozzleId: string
  nozzle: string
  produk: string
  /** Selisih bejana ukur 20 liter (ml). Negatif = kurang. */
  selisihMl: string
  /** Volume pump test uji kuantitas (L), standar 20. */
  pumpTest: string
  savedAt?: string
}

/** Foto wajib di akhir tiap uji: struk pump test dan pengembalian minyak ke tangki. */
export type QqFotoKey = 'kualitasStruk' | 'kualitasKembali' | 'kuantitasStruk' | 'kuantitasKembali'
export const QQ_FOTO: Record<QqFotoKey, string> = {
  kualitasStruk: 'Foto struk pump test',
  kualitasKembali: 'Foto pengembalian minyak ke tangki',
  kuantitasStruk: 'Foto struk pump test',
  kuantitasKembali: 'Foto pengembalian minyak ke tangki',
}

export interface QqData {
  petugas: string
  jam: string
  kualitas: QqKualitas[]
  kuantitas: QqKuantitas[]
  catatan: string
  foto?: Partial<Record<QqFotoKey, Photo[]>>
  /** Diisi saat uji diselesaikan (semua baris & foto lengkap). */
  selesaiAt?: string
}

interface DailyBase {
  id: string
  tanggal: string
  shift: Shift
  createdAt: number
  updatedAt: number
  createdBy: string | null
}
export type StokRecord = DailyBase & { kind: 'stok'; data: StokData }
export type QqRecord = DailyBase & { kind: 'qq'; data: QqData }
export type AparRecord = DailyBase & { kind: 'apar'; data: AparData }
export type InsidenRecord = DailyBase & { kind: 'insiden'; data: InsidenData }
export type TakarRecord = DailyBase & { kind: 'takar'; data: TakarData }
export type DailyRecord = StokRecord | QqRecord | AparRecord | InsidenRecord | TakarRecord

/** Toleransi uji bejana 20 liter: selisih di bawah -60 ml ditandai. */
export const BEJANA_LIMIT_ML = -60

export const newQqKualitas = (produk = ''): QqKualitas => ({ id: genId('qk'), produk, densityObs: '', suhu: '', pumpTest: '' })
export const newQqKuantitas = (nozzleId = '', nozzle = '', produk = ''): QqKuantitas => ({
  id: genId('qn'),
  nozzleId,
  nozzle,
  produk,
  selisihMl: '',
  pumpTest: '20',
})

export function bejanaStatus(selisihMl: string): 'kosong' | 'ok' | 'lewat' {
  const v = parseAngka(selisihMl)
  if (v === null) return 'kosong'
  return v < BEJANA_LIMIT_ML ? 'lewat' : 'ok'
}

export function qqD15(k: QqKualitas): { obs: number | null; d15: Density15 | null } {
  return { obs: normalizeDensity(k.densityObs), d15: density15(k.densityObs, k.suhu) }
}

/** Total volume pump test (L) dalam satu catatan Q&Q. */
export function totalPumpTest(d: QqData) {
  const sum = (xs: { pumpTest: string }[]) => xs.reduce((n, x) => n + (parseAngka(x.pumpTest) ?? 0), 0)
  return { kualitas: sum(d.kualitas), kuantitas: sum(d.kuantitas) }
}

export const stokRecordId = (tanggal: string, shift: Shift) => `stok_${tanggal}_${shift}`
export const qqRecordId = (tanggal: string, shift: Shift) => `qq_${tanggal}_${shift}`
