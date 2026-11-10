/**
 * Voucher Realisasi Petty Cash dalam format SPBU ("Format Voucher Realisasi Petty Cash.xlsx"): satu sheet per
 * bulan, voucher per tanggal realisasi bertumpuk ke bawah. Tiap voucher: kepala SPBU & nomor voucher, tabel
 * No / Nama Account / Keterangan / Jumlah (minimal 8 baris), Total (=SUM), terbilang, dan tanda tangan
 * BUH SPBU, Admin, Kasir.
 */
import type { Voucher } from '@/lib/petty'
import type { Settings } from '@/lib/sop'
import { terbilang } from '@/lib/so'
import { Lembar, tulisXlsx, type Gaya } from './xlsx-tulis'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BARIS_MIN = 8
const atas: Gaya = { garis: 'atas' }
const bawah: Gaya = { garis: 'bawah' }
const kotak: Gaya = { border: true }
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export interface VoucherInput {
  /** YYYY-MM */
  bulan: string
  vouchers: Voucher[]
  settings: Pick<Settings, 'kodeSpbu' | 'namaSpbu' | 'namaPengawasDefault'>
  /** Nama penanda tangan; kosong = garis titik untuk diisi tangan. */
  ttd: { buh: string; admin: string; kasir: string }
}

export function lembarVoucher({ bulan, vouchers, settings, ttd }: VoucherInput) {
  const l = new Lembar(`${BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`)
  l.kolom({ A: 12.45, B: 44.82, C: 26.18, D: 33.54, E: 3 })
  const nama = (settings.namaSpbu || 'SPBU').replace(/^SPBU\s*(COCO\s*)?/i, '').trim()
  let r = 4
  for (const v of vouchers) {
    const n = Math.max(BARIS_MIN, v.baris.length)
    l.merge(`A${r}:B${r}`, `SPBU COCO :  ${settings.kodeSpbu || ''}`, { ...atas, align: 'left' })
    l.set(`C${r}`, null, atas).set(`D${r}`, `No. Voucher : ${v.nomor}`, atas)
    l.set(`A${r + 1}`, null, bawah)
      .set(`B${r + 1}`, `SPBU ${nama}`.toUpperCase(), bawah)
      .set(`C${r + 1}`, null, bawah)
      .set(`D${r + 1}`, `Tanggal         : ${ddmmyyyy(v.tanggal)}`, bawah)
    const h = r + 3
    l.set(`A${h}`, 'No.', { ...kotak, align: 'center' }).set(`B${h}`, 'Nama Account', kotak).set(`C${h}`, 'Keterangan', kotak).set(`D${h}`, 'Jumlah', { ...kotak, align: 'center' })
    for (let i = 0; i < n; i++) {
      const b = v.baris[i]
      const rr = h + 1 + i
      l.set(`A${rr}`, i + 1, { ...kotak, align: 'center' })
        .set(`B${rr}`, b?.coa ?? null, kotak)
        .set(`C${rr}`, b?.keterangan ?? null, { ...kotak, align: 'left' })
        .set(`D${rr}`, b?.jumlah ?? null, { ...kotak, align: 'center', fmt: 'akun' })
    }
    const t = h + 1 + n
    l.merge(`A${t}:C${t}`, 'Total', { ...kotak, align: 'center' })
    l.set(`D${t}`, { f: `SUM(D${h + 1}:D${t - 1})`, v: v.total }, { ...kotak, fmt: 'akun' })
    l.merge(`A${t + 1}:D${t + 1}`, `Terbilang : ${terbilang(v.total)}.`, { ...atas, align: 'left' })
    l.merge(`A${t + 2}:D${t + 2}`, '.'.repeat(260), { align: 'center' })
    const s = t + 4
    const ttdGaya: Gaya = { b: true, sz: 10, border: true, align: 'center' }
    l.set(`B${s}`, 'BUH. SPBU', ttdGaya).set(`C${s}`, 'ADMIN', ttdGaya).set(`D${s}`, 'KASIR', ttdGaya)
    l.set(`B${s + 1}`, null, { sz: 10, ...atas }).set(`C${s + 1}`, null, { sz: 10, ...atas })
    const namaGaya: Gaya = { b: true, sz: 10, ...bawah, align: 'center' }
    const isi = (x: string) => x.trim() || '(.................................)'
    l.set(`B${s + 4}`, isi(ttd.buh), namaGaya).set(`C${s + 4}`, isi(ttd.admin), namaGaya).set(`D${s + 4}`, isi(ttd.kasir), namaGaya)
    // Voucher berikutnya: jarak sama dengan format asli (26 baris untuk 8 baris akun).
    r += 26 + (n - BARIS_MIN)
  }
  if (!vouchers.length) l.set('A4', 'Belum ada realisasi petty cash pada bulan ini.')
  return l
}

export async function exportVoucherXlsx(input: VoucherInput, filename: string) {
  const blob = await tulisXlsx([lembarVoucher(input)])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
