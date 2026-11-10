/**
 * Report > Laporan Stock Opname (BA Laporan Bulanan SPBU): satu catatan per bulan (tabel bbm_so, id YYYY-MM).
 * Mengikuti BA MONTHLY REPORT SPBU: 1. SO tangki pendam & meter listrik, 2. totalisator, 3. arus minyak,
 * 4. penerimaan BBM, 5. rekap tera nozzle, 6–9. cash opname (BBM, LPG, Enduro, petty cash),
 * 10. justifikasi sales/losses/Pertamina Way, 11. update pekerja.
 * Isian manual disimpan; data lain ditarik dari modul FLOQ: totalizer digital (Totalizer), penerimaan
 * (Input Bongkaran), pump test/tera (Kualitas Harian & Uji Takaran), SO bulan lalu (stok awal & D t-1).
 */
import type { Catatan } from '@/lib/catatan'
import { PECAHAN } from '@/lib/closing'
import { parseAngka } from '@/lib/format'
import type { BarisPumpTest } from '@/lib/pumptest'
import type { Nozzle, ReportSummary } from '@/lib/sop'
import { jualNozzle, type TotalizerRecord } from '@/lib/totalizer'
import type { Tank } from '@/lib/tank'

/** Batas konsistensi selisih dipping vs ATG antar waktu: 2,5 cm. */
export const BATAS_KONSISTENSI_CM = 2.5

export interface SoTangki {
  airCm: string
  dipCm: string
  dipL: string
  atgCm: string
  atgL: string
  /** SO lalu (D t-1): diisi otomatis dari SO bulan lalu bila ada. */
  laluTanggal: string
  laluDipCm: string
  laluAtgCm: string
}

export interface SoNozzle {
  /** R2 / R4 / R4 Red Carpet / R2 Self Service. */
  keterangan: string
  manualAwal: string
  manualAkhir: string
  /** Kosong = otomatis dari Totalizer (awal shift 1 tgl 1, akhir shift terakhir bulan ini). */
  digitalAwal: string
  digitalAkhir: string
}

export interface SoArus {
  /** Kosong = otomatis. */
  stokAwal: string
  penerimaan: string
  penjualan: string
}

export interface SoCash {
  /** Transaksi penjualan (petty cash: saldo per book / catatan kasir). */
  penjualan: string
  /** Non tunai per jenis (hanya BBM memakai rincian bank; lainnya kunci 'non_tunai'). */
  nonTunai: Record<string, string>
  pecahan: Record<string, string>
  /** Tanggal transaksi yang diperiksa. */
  tanggal: string
}

export type JenisCash = 'bbm' | 'lpg' | 'enduro' | 'petty'
export const CASH_SO: { key: JenisCash; judul: string; sheet: string; no: number }[] = [
  { key: 'bbm', judul: 'Berita Acara Cash Opname Penjualan BBM & BBK', sheet: 'BA Cash Opname Penj BBM&BBK', no: 6 },
  { key: 'lpg', judul: 'Berita Acara Cash Opname Penjualan LPG', sheet: 'BA Cash Opname Penj LPG', no: 7 },
  { key: 'enduro', judul: 'Berita Acara Cash Opname Penjualan Enduro Express', sheet: 'BA Cash Opname Penj Enduro', no: 8 },
  { key: 'petty', judul: 'Berita Acara Cash Opname Petty Cash', sheet: 'BA Cash Opname Petty Cash', no: 9 },
]
/** Rincian non tunai BA cash opname BBM (sesuai dokumen). */
export const NON_TUNAI_SO = ['EDC BCA', 'EDC Mandiri', 'EDC BNI', 'EDC BRI', 'EDC BTN', 'EDC OVO', 'EDC Link Aja', 'Customer Card', 'Voucher']

export const JABATAN_SO = ['Pws. BBM', 'Pws. NBBM', 'Ka. Shift', 'Pramuniaga (Opr)', 'Admin BOS', 'Admin Pelanggan', 'Kasir', 'Cleaning Service', 'Security', 'SA Bright', 'Mekanik BOM', 'Enduro Express']

export interface SoData {
  /** Tanggal & jam pelaksanaan SO (biasanya tgl 1 bulan berikutnya, 06:00). */
  tanggalSo: string
  jamSo: string
  tangki: Record<string, SoTangki>
  catatanAtg: string
  listrikAwal: string
  listrikAkhir: string
  nozzle: Record<string, SoNozzle>
  catatanTotalisator: string
  arus: Record<string, SoArus>
  cash: Record<JenisCash, SoCash>
  justifikasiSales: string
  justifikasiLosses: string
  justifikasiPw: string
  pekerja: Record<string, string>
  ttd: { pengawas: string; admin: string; abh: string; kasir: string }
}

export type SoRecord = Catatan<SoData>

export const kosongCash = (): SoCash => ({ penjualan: '', nonTunai: {}, pecahan: {}, tanggal: '' })
export function soKosong(): SoData {
  return {
    tanggalSo: '',
    jamSo: '06:00',
    tangki: {},
    catatanAtg: '',
    listrikAwal: '',
    listrikAkhir: '',
    nozzle: {},
    catatanTotalisator: '',
    arus: {},
    cash: { bbm: kosongCash(), lpg: kosongCash(), enduro: kosongCash(), petty: kosongCash() },
    justifikasiSales: '',
    justifikasiLosses: '',
    justifikasiPw: '',
    pekerja: {},
    ttd: { pengawas: '', admin: '', abh: '', kasir: '' },
  }
}

export const tangkiKosong = (): SoTangki => ({ airCm: '', dipCm: '', dipL: '', atgCm: '', atgL: '', laluTanggal: '', laluDipCm: '', laluAtgCm: '' })
export const nozzleKosong = (): SoNozzle => ({ keterangan: '', manualAwal: '', manualAkhir: '', digitalAwal: '', digitalAkhir: '' })

const n = (s: string | undefined) => parseAngka(s ?? '')

/** Baris BA SO tangki: selisih (e = a − c), konsistensi terhadap SO lalu, volume yang dipakai. */
export function hitungTangki(t: SoTangki) {
  const dip = n(t.dipCm)
  const atg = n(t.atgCm)
  const selisih = dip !== null && atg !== null ? Math.round((dip - atg) * 100) / 100 : null
  const ld = n(t.laluDipCm)
  const la = n(t.laluAtgCm)
  const selisihLalu = ld !== null && la !== null ? Math.round((ld - la) * 100) / 100 : null
  const konsistensiCm = selisih !== null && selisihLalu !== null ? Math.round((selisih - selisihLalu) * 100) / 100 : null
  // Tanpa SO lalu, konsistensi dari selisih saat ini saja.
  const acuan = konsistensiCm ?? selisih
  const konsisten = acuan === null ? null : Math.abs(acuan) <= BATAS_KONSISTENSI_CM + 1e-9
  const volume = konsisten === null ? (n(t.atgL) ?? n(t.dipL)) : konsisten ? (n(t.atgL) ?? n(t.dipL)) : (n(t.dipL) ?? n(t.atgL))
  return { selisih, selisihLalu, konsistensiCm, konsisten, volume }
}

/** Totalisator digital otomatis satu nozzle dari catatan Totalizer bulan ini. */
export function digitalOtomatis(nozzleId: string, recs: TotalizerRecord[]) {
  const urut = [...recs].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.shift - b.shift)
  const awal = urut.find((r) => n(r.data.nozzle[nozzleId]?.awal) !== null)?.data.nozzle[nozzleId]?.awal ?? ''
  const akhir = [...urut].reverse().find((r) => n(r.data.nozzle[nozzleId]?.akhir) !== null)?.data.nozzle[nozzleId]?.akhir ?? ''
  const jualShift = urut.reduce((s, r) => s + (jualNozzle(r.data.nozzle[nozzleId]) ?? 0), 0)
  return { awal, akhir, jualShift }
}

export function hitungNozzle(nz: Nozzle, d: SoNozzle | undefined, recs: TotalizerRecord[]) {
  const auto = digitalOtomatis(nz.id, recs)
  const dAwal = n(d?.digitalAwal) ?? n(auto.awal)
  const dAkhir = n(d?.digitalAkhir) ?? n(auto.akhir)
  const mAwal = n(d?.manualAwal)
  const mAkhir = n(d?.manualAkhir)
  const manual = mAwal !== null && mAkhir !== null ? mAkhir - mAwal : null
  const digital = dAwal !== null && dAkhir !== null ? dAkhir - dAwal : null
  return { dAwal, dAkhir, mAwal, mAkhir, manual, digital, selisih: manual !== null && digital !== null ? digital - manual : null, otomatis: !d?.digitalAwal && !d?.digitalAkhir }
}

/** Penerimaan BBM bulan ini (bongkaran selesai / menunggu TTD), urut tanggal. */
export function penerimaanBulan(reports: ReportSummary[], bulan: string) {
  return reports
    .filter((r) => r.status !== 'draft' && (r.tanggalShift || r.tanggal).startsWith(bulan))
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam))
    .map((r) => ({ r, order: r.volumeDO ?? 0, real: r.terimaAktual ?? r.realStok ?? null }))
}

/** Arus minyak per produk: a stok awal, b penerimaan (volume order), d penjualan bersih (− tera), f stok akhir real. */
export function hitungArus(
  produk: string,
  o: {
    tanks: Tank[]
    data: SoData
    lalu: SoData | null
    totalizer: TotalizerRecord[]
    nozzles: Nozzle[]
    penerimaan: ReturnType<typeof penerimaanBulan>
    pumpTest: BarisPumpTest[]
  },
) {
  const tangki = o.tanks.filter((t) => t.produk === produk)
  const isian = o.data.arus[produk]
  const stokLalu = o.lalu ? tangki.reduce((s, t) => s + (hitungTangki(o.lalu!.tangki[t.id] ?? tangkiKosong()).volume ?? 0), 0) : null
  const a = n(isian?.stokAwal) ?? stokLalu
  const b = n(isian?.penerimaan) ?? o.penerimaan.filter((x) => x.r.produk === produk).reduce((s, x) => s + x.order, 0)
  const tera = o.pumpTest.filter((x) => x.produk === produk).reduce((s, x) => s + x.liter, 0)
  const jualNz = o.nozzles.filter((z) => z.produk === produk).map((z) => hitungNozzle(z, o.data.nozzle[z.id], o.totalizer).digital)
  const kotor = jualNz.length && jualNz.every((x) => x !== null) ? jualNz.reduce((s, x) => s + (x ?? 0), 0) : null
  const d = n(isian?.penjualan) ?? (kotor === null ? null : kotor - tera)
  const vols = tangki.map((t) => hitungTangki(o.data.tangki[t.id] ?? tangkiKosong()).volume)
  const f = vols.length && vols.every((v) => v !== null) ? vols.reduce((s, v) => s + (v ?? 0), 0) : null
  const c = a === null ? null : a + b
  const e = c === null || d === null ? null : c - d
  const g = e === null || f === null ? null : f - e
  const h = g === null || !d ? null : (g / d) * 100
  return { produk, a, b, c, d, e, f, g, h, tera, kotor, otomatisA: n(isian?.stokAwal) === null, otomatisB: n(isian?.penerimaan) === null, otomatisD: n(isian?.penjualan) === null }
}

/** Cash opname satu bagian: total tunai seharusnya, hasil hitung fisik, selisih (lebih/kurang). */
export function hitungCashSo(c: SoCash, jenis: JenisCash) {
  const jual = n(c.penjualan) ?? 0
  const nonTunai = Object.values(c.nonTunai).reduce((s, v) => s + (n(v) ?? 0), 0)
  const fisik = PECAHAN.reduce((s, [k, , v]) => s + (n(c.pecahan[k]) ?? 0) * v, 0)
  // Petty cash: saldo per book vs hasil hitung.
  const seharusnya = jenis === 'petty' ? jual : jual - nonTunai
  return { jual, nonTunai, seharusnya, fisik, selisih: fisik - seharusnya }
}

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
/** Terbilang rupiah, mis. "Sepuluh Ribu Lima Ratus Rupiah". */
export function terbilang(x: number): string {
  const t = (v: number): string => {
    if (v < 12) return SATUAN[v]
    if (v < 20) return `${t(v - 10)} Belas`
    if (v < 100) return `${t(Math.floor(v / 10))} Puluh${v % 10 ? ` ${t(v % 10)}` : ''}`
    if (v < 200) return `Seratus${v - 100 ? ` ${t(v - 100)}` : ''}`
    if (v < 1000) return `${t(Math.floor(v / 100))} Ratus${v % 100 ? ` ${t(v % 100)}` : ''}`
    if (v < 2000) return `Seribu${v - 1000 ? ` ${t(v - 1000)}` : ''}`
    if (v < 1e6) return `${t(Math.floor(v / 1000))} Ribu${v % 1000 ? ` ${t(v % 1000)}` : ''}`
    if (v < 1e9) return `${t(Math.floor(v / 1e6))} Juta${v % 1e6 ? ` ${t(v % 1e6)}` : ''}`
    return `${t(Math.floor(v / 1e9))} Miliar${v % 1e9 ? ` ${t(v % 1e9)}` : ''}`
  }
  const v = Math.round(Math.abs(x))
  return v === 0 ? 'Nol Rupiah' : `${t(v)} Rupiah`
}
