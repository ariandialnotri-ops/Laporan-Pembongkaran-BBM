/**
 * Pelaporan insiden, near miss, dan kerusakan SPBU. Disimpan di bbm_daily (kind 'insiden'),
 * satu record per laporan; tindak lanjut ditambahkan ke riwayat laporan yang sama.
 */
import type { Photo } from '@/lib/sop'

export type JenisInsiden = 'insiden' | 'nearmiss' | 'kerusakan'
export type TingkatInsiden = 'rendah' | 'sedang' | 'tinggi'
export type StatusInsiden = 'terbuka' | 'proses' | 'selesai'

export const JENIS_INSIDEN: { value: JenisInsiden; label: string; desc: string }[] = [
  { value: 'insiden', label: 'Insiden', desc: 'Menimbulkan cedera, api, tumpahan BBM, atau kerugian' },
  { value: 'nearmiss', label: 'Near miss', desc: 'Hampir celaka, belum menimbulkan kerugian' },
  { value: 'kerusakan', label: 'Kerusakan', desc: 'Peralatan atau fasilitas SPBU rusak' },
]

export const KATEGORI_INSIDEN: Record<JenisInsiden, string[]> = {
  insiden: ['Cedera / kecelakaan kerja', 'Kebakaran / api', 'Tumpahan / kebocoran BBM', 'Kecelakaan kendaraan di area SPBU', 'Keamanan / pencurian', 'Lainnya'],
  nearmiss: ['Hampir tertabrak / terpeleset', 'Sumber api / merokok di area', 'Hampir tumpah saat bongkar / pengisian', 'Perilaku tidak aman', 'Kondisi tidak aman', 'Lainnya'],
  kerusakan: ['Dispenser / nozzle', 'Tangki pendam / ATG', 'Listrik / genset / panel', 'Bangunan / kanopi', 'APAR / proteksi kebakaran', 'Lainnya'],
}

export const TINGKAT_INSIDEN: { value: TingkatInsiden; label: string }[] = [
  { value: 'rendah', label: 'Rendah' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'tinggi', label: 'Tinggi' },
]

export const STATUS_INSIDEN: { value: StatusInsiden; label: string; tone: 'error' | 'neutral' | 'success' }[] = [
  { value: 'terbuka', label: 'Terbuka', tone: 'error' },
  { value: 'proses', label: 'Ditindaklanjuti', tone: 'neutral' },
  { value: 'selesai', label: 'Selesai', tone: 'success' },
]

export interface InsidenLangkah {
  at: string
  oleh: string
  status: StatusInsiden
  catatan: string
}

export interface InsidenData {
  jenis: JenisInsiden
  kategori: string
  jam: string
  lokasi: string
  /** Peralatan yang terlibat/rusak (mis. Nozzle 2, Dispenser 1). */
  aset: string
  uraian: string
  penyebab: string
  tindakanSegera: string
  /** Korban / dampak (insiden). */
  dampak: string
  tingkat: TingkatInsiden
  pelapor: string
  foto: Photo[]
  status: StatusInsiden
  pic: string
  targetSelesai: string
  riwayat: InsidenLangkah[]
}

export const jenisLabel = (j: JenisInsiden) => JENIS_INSIDEN.find((x) => x.value === j)?.label ?? j
export const statusMeta = (s: StatusInsiden) => STATUS_INSIDEN.find((x) => x.value === s) ?? STATUS_INSIDEN[0]
