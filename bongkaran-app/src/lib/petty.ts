/**
 * Finance > Petty Cash: pengajuan pengadaan barang/jasa (wajib akun COA dari One Touch Solution) dan
 * realisasi anggaran (nota wajib). Alur: persetujuan 1 Admin/Cashier, persetujuan akhir ABH. Aturan alur
 * juga dijaga trigger database bbm_petty.
 */
import type { Coa } from '@/lib/coa'
import type { Photo } from '@/lib/sop'

export type StatusPetty = 'Menunggu Admin' | 'Menunggu ABH' | 'Disetujui' | 'Ditolak'

export interface Tanda {
  by: string | null
  nama: string
  at: string
  catatan: string
}

export interface Realisasi {
  tanggal: string
  nominal: number
  catatan: string
  /** Foto nota/kuitansi (wajib). */
  nota: Photo[]
  by: string | null
  nama: string
  at: string
}

export interface PettyData {
  coa: Pick<Coa, 'accountNo' | 'activity' | 'sapAccount' | 'coaId'>
  /** Barang/jasa yang diadakan. */
  uraian: string
  qty: number
  satuan: string
  harga: number
  total: number
  vendor: string
  /** Keperluan / alasan pengadaan. */
  alasan: string
  /** Foto penawaran/contoh barang (opsional). */
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

/** Status tampilan: pengajuan yang disetujui dan sudah direalisasi. */
export const labelStatus = (r: PettyRecord) => (r.status === 'Disetujui' && r.data.realisasi ? 'Terealisasi' : r.status)

/** Rekap per COA: anggaran (pengajuan disetujui) vs realisasi pada daftar pengajuan. */
export function rekapCoa(recs: PettyRecord[]) {
  const m = new Map<string, { coa: PettyData['coa']; anggaran: number; realisasi: number; jumlah: number }>()
  for (const r of recs) {
    if (r.status !== 'Disetujui') continue
    const x = m.get(r.data.coa.accountNo) ?? { coa: r.data.coa, anggaran: 0, realisasi: 0, jumlah: 0 }
    x.anggaran += r.total
    x.realisasi += r.data.realisasi?.nominal ?? 0
    x.jumlah++
    m.set(r.data.coa.accountNo, x)
  }
  return [...m.values()].sort((a, b) => b.anggaran - a.anggaran)
}
