/**
 * Whistle Blowing System (WBS): laporan rahasia pelanggaran dari semua peran. Hanya ABH pengendali
 * SPBU yang dapat membaca dan menindaklanjuti. Laporan anonim tidak menyimpan akun pelapor.
 */
import type { Photo } from '@/lib/sop'

export type StatusWbs = 'baru' | 'ditinjau' | 'selesai'

export const KATEGORI_WBS: { value: string; label: string; desc: string }[] = [
  { value: 'subsidi', label: 'Penyimpangan BBM subsidi', desc: 'Pengisian tidak sesuai ketentuan, jeriken/pengetap, kendaraan tidak berhak' },
  { value: 'kecurangan', label: 'Kecurangan / manipulasi', desc: 'Takaran, data stok, uang setoran, atau dokumen dipalsukan' },
  { value: 'pencurian', label: 'Pencurian / penggelapan', desc: 'BBM, uang, barang, atau aset SPBU' },
  { value: 'gratifikasi', label: 'Suap / gratifikasi', desc: 'Menerima atau meminta imbalan yang tidak semestinya' },
  { value: 'wewenang', label: 'Penyalahgunaan wewenang', desc: 'Atasan atau rekan memakai jabatan untuk kepentingan pribadi' },
  { value: 'pelecehan', label: 'Pelecehan / kekerasan', desc: 'Perundungan, pelecehan, ancaman, atau kekerasan di tempat kerja' },
  { value: 'k3', label: 'Pelanggaran K3 / SOP berat', desc: 'Sengaja mengabaikan keselamatan atau prosedur operasi' },
  { value: 'lainnya', label: 'Lainnya', desc: 'Pelanggaran etika atau aturan lain' },
]
export const kategoriWbs = (v: string) => KATEGORI_WBS.find((k) => k.value === v)

export const STATUS_WBS: { value: StatusWbs; label: string; tone: 'error' | 'neutral' | 'success' }[] = [
  { value: 'baru', label: 'Baru', tone: 'error' },
  { value: 'ditinjau', label: 'Ditinjau', tone: 'neutral' },
  { value: 'selesai', label: 'Selesai', tone: 'success' },
]
export const statusWbs = (s: StatusWbs) => STATUS_WBS.find((x) => x.value === s) ?? STATUS_WBS[0]

export interface WbsLangkah {
  at: string
  oleh: string
  status: StatusWbs
  catatan: string
}

/** Isian pelapor. */
export interface WbsInput {
  kategori: string
  tanggal: string
  jam: string
  lokasi: string
  /** Pihak yang terlibat (nama/jabatan), opsional. */
  terlibat: string
  uraian: string
  anonim: boolean
  /** Kontak pelapor bila bersedia dihubungi (hanya bila tidak anonim). */
  kontak: string
}

export interface WbsData extends WbsInput {
  foto: Photo[]
  /** Tindak lanjut ABH. */
  riwayat: WbsLangkah[]
}

export interface WbsRecord {
  id: string
  status: StatusWbs
  data: WbsData
  createdAt: string
  /** Akun pelapor; null bila anonim. */
  createdBy: string | null
}

/** Nomor tiket yang ditunjukkan ke pelapor, mis. WBS-20261015-7K3QX. */
export function nomorWbs(d = new Date()) {
  const tgl = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const buf = new Uint32Array(5)
  crypto.getRandomValues(buf)
  return `WBS-${tgl}-${Array.from(buf, (n) => huruf[n % huruf.length]).join('')}`
}
