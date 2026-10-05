/**
 * Proteksi kebakaran SPBU: daftar APAR (alat pemadam api ringan) dan APAB
 * (alat pemadam api berat/beroda) di Pengaturan, dan inspeksi berkala per unit.
 */
import { addDays, todayIso as isoOf } from '@/lib/date'
import type { Photo } from '@/lib/sop'

export type AparTipe = 'apar' | 'apab'

export interface AparUnit {
  id: string
  /** Kode/nomor unit pada tabung, mis. "APAR-01". */
  kode: string
  jenis: string
  kapasitasKg: string
  lokasi: string
  /** Unit cadangan (disimpan, belum dipasang). */
  cadangan: boolean
  /** Tanggal isi ulang berikutnya / kedaluwarsa (YYYY-MM-DD). */
  kedaluwarsa: string
}

export const APAR_JENIS = ['Powder (DCP)', 'CO2', 'Foam (AFFF)', 'Clean agent'] as const

/** Pilihan lokasi: pulau pompa sesuai jumlah pulau, lalu area umum SPBU. */
export function lokasiOptions(jumlahPulau: number) {
  return [
    ...Array.from({ length: Math.max(0, jumlahPulau) }, (_, i) => `Pulau pompa ${i + 1}`),
    'Area tangki pendam / fill pit',
    'Kantor / ruang administrasi',
    'Ruang genset / panel listrik',
    'Kompresor / area servis',
    'Gudang',
    'Minimarket / area umum',
  ]
}

export type CekKey = 'lokasi' | 'tanda' | 'tekanan' | 'pin' | 'tabung' | 'selang' | 'label' | 'kartu' | 'kedaluwarsa' | 'roda'

/** Butir inspeksi umum APAR/APAB (pemeriksaan bulanan). */
export const CEK_ITEMS: { key: CekKey; label: string; hint?: string; untuk?: AparTipe; aktifSaja?: boolean }[] = [
  { key: 'lokasi', label: 'Terpasang di tempatnya, mudah dijangkau, tidak terhalang', aktifSaja: true },
  { key: 'tanda', label: 'Tanda/label lokasi pemadam terpasang dan terlihat', aktifSaja: true },
  { key: 'tekanan', label: 'Tekanan manometer di zona hijau', hint: 'CO2 tanpa manometer: berat tabung sesuai' },
  { key: 'pin', label: 'Pin pengaman dan segel utuh' },
  { key: 'tabung', label: 'Tabung tidak penyok, berkarat, atau bocor' },
  { key: 'selang', label: 'Selang dan nozzle utuh, tidak retak atau tersumbat' },
  { key: 'label', label: 'Label petunjuk penggunaan terbaca' },
  { key: 'kartu', label: 'Kartu/tag inspeksi terpasang dan diisi' },
  { key: 'kedaluwarsa', label: 'Masa isi ulang/kedaluwarsa masih berlaku' },
  { key: 'roda', label: 'Roda dan troli berfungsi baik', untuk: 'apab' },
]

export const cekUntuk = (tipe: AparTipe, cadangan: boolean) => CEK_ITEMS.filter((c) => (!c.untuk || c.untuk === tipe) && (!c.aktifSaja || !cadangan))

export type CekNilai = 'ok' | 'tidak'

/** Hasil inspeksi satu unit; data unit disalin agar riwayat tetap utuh walau pengaturan berubah. */
export interface AparCek {
  unitId: string
  tipe: AparTipe
  kode: string
  jenis: string
  kapasitasKg: string
  lokasi: string
  cadangan: boolean
  kedaluwarsa: string
  cek: Partial<Record<CekKey, CekNilai>>
  catatan: string
  foto: Photo[]
}

export interface AparData {
  petugas: string
  jam: string
  units: AparCek[]
  catatan: string
  /** Diisi saat inspeksi diselesaikan (semua butir terisi). */
  selesaiAt?: string
}

export const aparRecordId = (tanggal: string) => `apar_${tanggal}`

export function cekDari(u: AparUnit, tipe: AparTipe): AparCek {
  return { unitId: u.id, tipe, kode: u.kode, jenis: u.jenis, kapasitasKg: u.kapasitasKg, lokasi: u.lokasi, cadangan: u.cadangan, kedaluwarsa: u.kedaluwarsa, cek: {}, catatan: '', foto: [] }
}

/** Butir yang belum diisi, dan butir yang ditandai "Tidak" (temuan). */
export function hasilCek(c: AparCek) {
  const items = cekUntuk(c.tipe, c.cadangan)
  const kosong = items.filter((i) => !c.cek[i.key])
  const temuan = items.filter((i) => c.cek[i.key] === 'tidak')
  return { items, kosong, temuan }
}

/** Kedaluwarsa sudah lewat (atau dalam 30 hari). */
export function statusKedaluwarsa(tgl: string, todayIso: string): 'lewat' | 'segera' | 'ok' | null {
  if (!tgl) return null
  if (tgl < todayIso) return 'lewat'
  return tgl <= isoOf(addDays(new Date(`${todayIso}T00:00:00`), 30)) ? 'segera' : 'ok'
}
