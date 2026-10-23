/**
 * Water content tangki pendam: pengecekan air dengan pasta air pada stik ukur di setiap tangki,
 * sekali sehari di shift 1 (paling lambat 10:00), satu catatan berisi semua tangki. Air wajib nihil
 * (0 mm); bila ada air, tindakan (pengurasan/penyedotan, lapor pengawas) wajib dicatat. Disimpan di
 * tabel bbm_air sebagai shift 1. Foto tidak disimpan: digabung menjadi kolase dan dikirim ke WhatsApp.
 */
import { formatLiter, parseAngka } from '@/lib/format'
import type { Shift } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { tankName, volumeTank, type Tank } from '@/lib/tank'

export interface AirTangki {
  /** Tinggi air di dasar tangki (mm); "0" = nihil. */
  airMm: string
  /** Volume air dari tabel kalibrasi tangki (liter), bila tinggi air masuk rentang tabel. */
  liter: number | null
  /** Hanya catatan lama; catatan baru mengirim foto lewat WhatsApp (tidak disimpan). */
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
  /** Diisi setelah batas pukul 10:00. */
  terlambat?: boolean
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

/** Semua tangki terisi pada catatan ini. */
export const airLengkap = (r: AirRecord | undefined, tanks: Tank[]) => !!r && tanks.every((t) => statusAir(r.data.tangki[t.id]) !== 'kosong')

/** Tangki yang ada airnya pada catatan ini. */
export const tangkiBerair = (r: AirRecord | undefined, tanks: Tank[]) => (r ? tanks.filter((t) => statusAir(r.data.tangki[t.id]) === 'ada') : [])

// Ringkas supaya muat satu baris di layar HP: "T1 Pertalite", nama khusus tetap (mis. "PERTADEX 3 KL").
const namaWa = (t: Tank) => (/^\d+$/.test(t.tankNo) ? `T${t.tankNo} ${t.produk}` : t.tankNo)

/**
 * Baris laporan WhatsApp water content: hasil per tangki (blok monospace, titik dua sejajar dengan
 * label `kiri` lain), hasil, dan tindakan. Bagian dari laporan Kontrol Kualitas Harian.
 */
export function barisWaAir(rec: AirRecord, tanks: Tank[], kiri: string[] = []) {
  const d = rec.data
  const lebar = Math.max(...[...kiri, ...tanks.map(namaWa)].map((k) => k.length))
  const kv = (k: string, v: string) => `${k.padEnd(lebar)} : ${v}`
  const isi = (t: Tank) => {
    const x = d.tangki[t.id]
    if (statusAir(x) !== 'ada' || !x) return 'Nihil'
    const l = x.liter ?? literAir(t, x.airMm)
    return `${x.airMm} mm${l ? ` (± ${formatLiter(l)})` : ''}`
  }
  const berair = tangkiBerair(rec, tanks)
  return {
    kv,
    tangki: tanks.map((t) => kv(namaWa(t), isi(t))),
    hasil: [
      berair.length ? `Hasil: *ada air di ${berair.map((t) => tankName(t.tankNo)).join(', ')}*` : 'Hasil: semua tangki *nihil air*',
      ...berair.map((t) => `Tindakan ${tankName(t.tankNo)}: ${d.tangki[t.id]?.tindakan || '-'}`),
    ],
  }
}
