/**
 * Finance > Petty Cash: pengajuan pengadaan barang/jasa atau reimburse oleh anggota di bawah ABH (kepala
 * shift, pengawas, Admin/Cashier, security, cleaning service), persetujuan 1 Admin/Cashier, persetujuan
 * akhir ABH, lalu realisasi oleh Admin/Cashier dengan akun COA (One Touch Solution) dan voucher realisasi.
 * Aturan alur juga dijaga trigger database bbm_petty.
 */
import type { Coa } from '@/lib/coa'
import type { Role } from '@/lib/roles'
import type { Photo } from '@/lib/sop'

export type StatusPetty = 'Menunggu Admin' | 'Menunggu ABH' | 'Disetujui' | 'Ditolak'

export interface Tanda {
  by: string | null
  nama: string
  at: string
  catatan: string
}

/**
 * pengadaan = uang muka dari kas petty cash lalu direalisasi dengan nota;
 * reimburse = pengaju sudah membayar sendiri (nota dilampirkan saat pengajuan), kas mengganti setelah disetujui.
 */
export type JenisPetty = 'pengadaan' | 'reimburse'
export const JENIS_PETTY: { value: JenisPetty; label: string; desc: string }[] = [
  { value: 'pengadaan', label: 'Pengadaan', desc: 'Minta dana dulu, belanja setelah disetujui, lalu realisasi dengan nota' },
  { value: 'reimburse', label: 'Reimburse', desc: 'Sudah dibayar sendiri, nota dilampirkan, kas mengganti setelah disetujui' },
]

/** Peran yang boleh mengajukan: anggota di bawah ABH (ABH adalah pemberi persetujuan akhir). */
export const PERAN_PENGAJU: Role[] = ['kashift', 'pengawas', 'admin', 'security', 'cs']
/** Realisasi (pilih COA, catat nota, voucher) oleh Admin/Cashier; ABH sebagai cadangan. */
export const bolehRealisasi = (role: Role | null) => role === 'admin' || role === 'abh'
/** Security & cleaning service hanya melihat pengajuan dari perannya sendiri (sama dengan RLS bbm_petty). */
export const bolehLihatPetty = (r: PettyRecord, role: Role | null, uid: string | null) =>
  role === 'abh' || role === 'admin' || role === 'pengawas' || role === 'kashift' || r.data.peran === role || (!!uid && r.createdBy === uid)

export interface Realisasi {
  tanggal: string
  nominal: number
  /** Akun COA dipilih Admin/Cashier saat realisasi. */
  coa?: Pick<Coa, 'accountNo' | 'activity' | 'sapAccount' | 'coaId'>
  catatan: string
  /** Foto nota/kuitansi (wajib). */
  nota: Photo[]
  by: string | null
  nama: string
  at: string
}

export interface PettyData {
  /** Bawaan pengadaan (pengajuan lama). */
  jenis?: JenisPetty
  /** Pengajuan lama: COA dipilih saat pengajuan. Sekarang COA dipilih saat realisasi. */
  coa?: Pick<Coa, 'accountNo' | 'activity' | 'sapAccount' | 'coaId'>
  /** Peran pengaju (diisi database): laporan pengajuan per peran (mis. Cleaning Service). */
  peran?: Role
  /** Barang/jasa yang diadakan. */
  uraian: string
  qty: number
  satuan: string
  harga: number
  total: number
  vendor: string
  /** Keperluan / alasan pengadaan. */
  alasan: string
  /** Foto penawaran/contoh barang (pengadaan, opsional) atau nota pembayaran (reimburse, wajib). */
  lampiran: Photo[]
  diajukanNama: string
  review?: Tanda
  keputusan?: Tanda
  realisasi?: Realisasi
}

export interface PettyRecord {
  id: string
  /** PC-YYYYMM-001. */
  no: string
  tanggal: string
  status: StatusPetty
  total: number
  data: PettyData
  createdAt: number
  createdBy: string | null
}

export const pettyId = () => `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
export const nomorPetty = (tanggal: string, urut: number) => `PC-${tanggal.slice(0, 7).replace('-', '')}-${String(urut).padStart(3, '0')}`

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

export const jenisPetty = (r: PettyRecord): JenisPetty => r.data.jenis ?? 'pengadaan'
/** Akun COA pengajuan: dari realisasi (sekarang) atau dari pengajuan (data lama). */
export const coaPetty = (r: PettyRecord) => r.data.realisasi?.coa ?? r.data.coa ?? null

/** Status tampilan: pengajuan yang disetujui dan sudah direalisasi / dibayar (reimburse). */
export const labelStatus = (r: PettyRecord) => (r.status === 'Disetujui' && r.data.realisasi ? (jenisPetty(r) === 'reimburse' ? 'Dibayar' : 'Terealisasi') : r.status)

/** Rekap per COA: pengajuan disetujui yang sudah direalisasi (COA dipilih saat realisasi). */
export function rekapCoa(recs: PettyRecord[]) {
  const m = new Map<string, { coa: NonNullable<PettyData['coa']>; anggaran: number; realisasi: number; jumlah: number }>()
  for (const r of recs) {
    const coa = coaPetty(r)
    if (r.status !== 'Disetujui' || !coa) continue
    const x = m.get(coa.accountNo) ?? { coa, anggaran: 0, realisasi: 0, jumlah: 0 }
    x.anggaran += r.total
    x.realisasi += r.data.realisasi?.nominal ?? 0
    x.jumlah++
    m.set(coa.accountNo, x)
  }
  return [...m.values()].sort((a, b) => b.anggaran - a.anggaran)
}

export interface BarisVoucher {
  coa: string
  keterangan: string
  jumlah: number
  no: string
}
export interface Voucher {
  /** "12/COCO/06/2024": tanggal realisasi / COCO / bulan / tahun (format voucher SPBU). */
  nomor: string
  tanggal: string
  baris: BarisVoucher[]
  total: number
}

/** Voucher realisasi petty cash per tanggal realisasi (format "Format Voucher Realisasi Petty Cash"). */
export function voucherBulan(recs: PettyRecord[], bulan: string): Voucher[] {
  const per = new Map<string, BarisVoucher[]>()
  for (const r of recs) {
    const x = r.data.realisasi
    if (r.status !== 'Disetujui' || !x || !x.tanggal.startsWith(bulan)) continue
    const coa = coaPetty(r)
    const ket = `${jenisPetty(r) === 'reimburse' ? 'Reimburse ' : ''}${r.data.uraian}`
    per.set(x.tanggal, [...(per.get(x.tanggal) ?? []), { coa: coa?.activity ?? '-', keterangan: ket, jumlah: x.nominal, no: r.no }])
  }
  return [...per.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tanggal, baris]) => ({ nomor: `${Number(tanggal.slice(8))}/COCO/${tanggal.slice(5, 7)}/${tanggal.slice(0, 4)}`, tanggal, baris, total: baris.reduce((a, b) => a + b.jumlah, 0) }))
}
