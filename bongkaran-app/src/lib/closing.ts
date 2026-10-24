/**
 * Finance > Closing Shift (kepala shift, hitung buta). Format sama dengan closing shift aplikasi One Touch
 * Solution (tabel spbu.evidence_closing: cash, edc_bca, edc_bri, edc_mandiri, edc_bni, myp_linkaja, rfid,
 * e_voucher, p_voucher, pecahan) sehingga dapat diteruskan apa adanya. Penjualan ditarik dari Totalizer
 * shift yang sama × harga jual per liter. Foto struk tidak disimpan: kolase dikirim ke WhatsApp.
 */
import type { Catatan } from '@/lib/catatan'
import { namaSpbuWa, tanggalPanjang } from '@/lib/gts'
import { jualPerProduk, type PumpTestShift, type TotalizerRecord } from '@/lib/totalizer'
import type { Settings } from '@/lib/sop'

/** [kunci, label, nilai, k = kertas | l = logam] (DENOMS One Touch). */
export const PECAHAN: [string, string, number, 'k' | 'l'][] = [
  ['d100000', '100.000', 100000, 'k'],
  ['d50000', '50.000', 50000, 'k'],
  ['d20000', '20.000', 20000, 'k'],
  ['d10000', '10.000', 10000, 'k'],
  ['d5000', '5.000', 5000, 'k'],
  ['d2000', '2.000', 2000, 'k'],
  ['d1000k', '1.000', 1000, 'k'],
  ['d1000c', '1.000', 1000, 'l'],
  ['d500', '500', 500, 'l'],
  ['d200', '200', 200, 'l'],
  ['d100', '100', 100, 'l'],
  ['d50', '50', 50, 'l'],
]

export type NonTunaiKey = 'edc_bca' | 'edc_bri' | 'edc_mandiri' | 'edc_bni' | 'myp_linkaja' | 'rfid' | 'e_voucher' | 'p_voucher'
/** Kolom non tunai (COLS One Touch). */
export const NON_TUNAI: [NonTunaiKey, string][] = [
  ['edc_bca', 'EDC BCA (debit + kredit + QRIS)'],
  ['edc_bri', 'EDC BRI'],
  ['edc_mandiri', 'EDC Mandiri'],
  ['edc_bni', 'EDC BNI'],
  ['myp_linkaja', 'MyPertamina / LinkAja'],
  ['rfid', 'RFID (Customer Card)'],
  ['e_voucher', 'E-Voucher'],
  ['p_voucher', 'P-Voucher'],
]

export type NonFuelKey = 'lpg' | 'enduro' | 'bbk_kemasan'
/** Penjualan non BBM yang ikut disetor (nonfuel_shift One Touch). */
export const NON_FUEL: [NonFuelKey, string][] = [
  ['lpg', 'LPG'],
  ['enduro', 'Enduro Express'],
  ['bbk_kemasan', 'BBK kemasan'],
]

export interface PenjualanProduk {
  produk: string
  /** Penjualan bersih: selisih totalisator − pump test. */
  liter: number
  /** Pump test shift ini (L) yang sudah dikurangkan; kosong pada closing lama. */
  pumpTest?: number
  /** Harga per liter saat closing (null = belum diatur). */
  harga: number | null
  rupiah: number | null
}

export interface ClosingData {
  petugas: string
  jam: string
  /** Jumlah lembar/keping per pecahan (kunci PECAHAN). */
  pecahan: Record<string, number>
  /** Fisik kas (hasil hitung pecahan). */
  cash: number
  nonTunai: Record<NonTunaiKey, number>
  nonFuel: Record<NonFuelKey, number>
  /** Dari totalizer shift ini; kosong bila totalizer belum lengkap. */
  penjualan: PenjualanProduk[]
  totalizerLengkap: boolean
  catatan: string
}

export type ClosingRecord = Catatan<ClosingData>

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + (b || 0), 0)

export const hitungCash = (pecahan: Record<string, number>) => PECAHAN.reduce((n, [k, , v]) => n + (pecahan[k] || 0) * v, 0)

/** Penjualan BBM bersih per produk (totalisator − pump test) shift ini × harga jual. */
export function penjualanDari(tot: TotalizerRecord | undefined, harga: Settings['hargaProduk'], pumpTest?: PumpTestShift): PenjualanProduk[] {
  if (!tot) return []
  return jualPerProduk([tot], pumpTest).map(({ produk, liter, pumpTest: pt }) => {
    const h = harga?.[produk] || null
    return { produk, liter, pumpTest: pt, harga: h, rupiah: h === null ? null : Math.round(liter * h) }
  })
}

/** Ringkasan rekonsiliasi: penjualan BBM + non BBM − non tunai = tunai seharusnya; selisih = fisik − seharusnya. */
export function ringkasClosing(d: ClosingData) {
  const bbmLengkap = d.totalizerLengkap && d.penjualan.length > 0 && d.penjualan.every((p) => p.rupiah !== null)
  const bbm = d.penjualan.reduce((n, p) => n + (p.rupiah ?? 0), 0)
  const nonFuel = sum(d.nonFuel)
  const nonTunai = sum(d.nonTunai)
  const seharusnya = bbm + nonFuel - nonTunai
  return { bbmLengkap, bbm, nonFuel, nonTunai, seharusnya, selisih: bbmLengkap ? d.cash - seharusnya : null }
}

export const labelSelisih = (s: number | null) => (s === null ? 'Belum dapat dihitung' : s === 0 ? 'Sesuai (Rp 0)' : s > 0 ? `Lebih ${rupiah(s)}` : `Kurang ${rupiah(-s)}`)

/** Teks laporan WhatsApp closing shift (isian dalam blok monospace supaya titik dua sejajar). */
export function teksWaClosing(rec: ClosingRecord, s: Pick<Settings, 'namaSpbu' | 'kodeSpbu'>, zona = '') {
  const d = rec.data
  const r = ringkasClosing(d)
  const baris: [string, string][] = [
    ['Shift', String(rec.shift)],
    ['Kepala Shift', d.petugas || '-'],
    ...d.penjualan.map((p): [string, string] => [p.produk, `${p.liter.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L${p.rupiah !== null ? ` = ${rupiah(p.rupiah)}` : ''}`]),
    ['Penjualan BBM', d.totalizerLengkap ? rupiah(r.bbm) : 'Totalizer belum lengkap'],
    ...NON_FUEL.filter(([k]) => d.nonFuel[k]).map(([k, l]): [string, string] => [l, rupiah(d.nonFuel[k])]),
    ...NON_TUNAI.filter(([k]) => d.nonTunai[k]).map(([k, l]): [string, string] => [l.replace(/ \(.*\)$/, ''), rupiah(d.nonTunai[k])]),
    ['Total Non Tunai', rupiah(r.nonTunai)],
    ['Tunai Seharusnya', r.bbmLengkap ? rupiah(r.seharusnya) : '-'],
    ['Fisik Kas', rupiah(d.cash)],
    ['Selisih', labelSelisih(r.selisih)],
  ]
  const lebar = Math.max(...baris.map(([k]) => k.length))
  return [
    '*Laporan Closing Shift (Setoran Tepat)*',
    namaSpbuWa(s),
    `Tanggal ${tanggalPanjang(rec.tanggal)}, ${d.jam}${zona ? ` ${zona}` : ''}`,
    '',
    '```',
    ...baris.map(([k, v]) => `${k.padEnd(lebar)} : ${v}`),
    '```',
    ...(d.catatan ? [`Catatan: ${d.catatan}`] : []),
  ].join('\n')
}
