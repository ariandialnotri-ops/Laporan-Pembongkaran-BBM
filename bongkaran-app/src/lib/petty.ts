/**
 * Finance > Petty Cash (disebut "Pengajuan Anggaran" untuk peran selain ABH & Admin/Cashier): pengajuan
 * pengadaan barang/jasa atau reimburse oleh seluruh personil kecuali ABH, persetujuan 1 Admin/Cashier,
 * persetujuan akhir ABH, Create Settlement oleh pengaju (foto struk pembelian & foto barang), lalu realisasi
 * oleh Admin/Cashier dengan akun COA (One Touch Solution) dan voucher petty cash. Aturan alur juga dijaga
 * trigger database bbm_petty.
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

/** Nama modul: "Petty Cash" untuk ABH & Admin/Cashier, "Pengajuan Anggaran" untuk personil lain. */
export const namaModulPetty = (role: Role | null) => (role === 'abh' || role === 'admin' ? 'Petty Cash' : 'Pengajuan Anggaran')

/** Peran yang boleh mengajukan: seluruh personil kecuali ABH (ABH adalah pemberi persetujuan akhir). */
export const PERAN_PENGAJU: Role[] = ['kashift', 'pengawas', 'admin', 'security', 'cs']
/** Realisasi (pilih COA, catat nota, voucher) oleh Admin/Cashier; ABH sebagai cadangan. */
export const bolehRealisasi = (role: Role | null) => role === 'admin' || role === 'abh'
/** Plafon, anggaran disetujui, realisasi & nominal pengajuan hanya untuk Admin/Cashier dan ABH. */
export const bolehLihatAnggaran = bolehRealisasi
/** Nominal satu pengajuan: Admin/Cashier & ABH, atau pengaju sendiri. */
export const bolehLihatNominal = (r: Pick<PettyRecord, 'createdBy'>, role: Role | null, uid: string | null) => bolehLihatAnggaran(role) || (!!uid && r.createdBy === uid)
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

/** Create Settlement: pertanggungjawaban pengaju setelah pengajuan disetujui (sebelum realisasi). */
export interface Settlement {
  tanggal: string
  /** Nominal yang benar-benar dibelanjakan. */
  nominal: number
  /** Foto struk / nota pembelian (wajib). */
  struk: Photo[]
  /** Foto barang yang dibeli (wajib). */
  barang: Photo[]
  catatan: string
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
  settlement?: Settlement
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
export const labelStatus = (r: PettyRecord) =>
  r.status === 'Disetujui' && r.data.realisasi ? (jenisPetty(r) === 'reimburse' ? 'Dibayar' : 'Terealisasi') : r.status === 'Disetujui' && perluSettlement(r) ? 'Menunggu Settlement' : r.status === 'Disetujui' && r.data.settlement ? 'Settlement' : r.status

/** Pengadaan yang disetujui wajib Create Settlement (struk & foto barang) sebelum direalisasi. */
export const perluSettlement = (r: PettyRecord) => r.status === 'Disetujui' && jenisPetty(r) === 'pengadaan' && !r.data.settlement && !r.data.realisasi

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

/** Satu baris voucher petty cash cetak (rentang tanggal pengajuan) beserta lampiran fotonya. */
export interface BarisVoucherCetak extends BarisVoucher {
  uraian: string
  tanggalPengajuan: string
  tanggalRealisasi: string
  pengaju: string
  /** Foto struk/nota (settlement, nota realisasi, atau nota reimburse). */
  struk: Photo[]
  /** Foto barang yang dibeli (settlement). */
  barang: Photo[]
}

/**
 * Voucher petty cash untuk rentang tanggal pengajuan (mis. 1 s.d. 7 Oktober): pengajuan disetujui yang
 * sudah direalisasi dengan akun COA, urut tanggal pengajuan, lengkap dengan foto struk & barang.
 */
export function voucherRentang(recs: PettyRecord[], dari: string, sampai: string): BarisVoucherCetak[] {
  return recs
    .filter((r) => r.status === 'Disetujui' && r.data.realisasi && coaPetty(r) && r.tanggal >= dari && r.tanggal <= sampai)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.no.localeCompare(b.no))
    .map((r) => {
      const x = r.data.realisasi!
      const st = r.data.settlement
      return {
        coa: coaPetty(r)!.activity,
        keterangan: `${jenisPetty(r) === 'reimburse' ? 'Reimburse ' : ''}${r.data.uraian}`,
        jumlah: x.nominal,
        no: r.no,
        uraian: r.data.uraian,
        tanggalPengajuan: r.tanggal,
        tanggalRealisasi: x.tanggal,
        pengaju: r.data.diajukanNama,
        struk: [...(st?.struk ?? []), ...x.nota, ...(jenisPetty(r) === 'reimburse' ? r.data.lampiran : [])],
        barang: st?.barang ?? [],
      }
    })
}
