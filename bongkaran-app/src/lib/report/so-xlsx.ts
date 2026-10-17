/**
 * Excel BA Laporan Bulanan (stock opname) dengan susunan lembar seperti BA MONTHLY REPORT SPBU:
 * Daftar Isi, BA SO BBM, BA Totalisator, BA Arus Minyak, BA Penerimaan BBM&BBK, BA Rekap Terra Nozzle,
 * BA Cash Opname (BBM, LPG, Enduro, Petty Cash), Justifikasi, Update Pekerja. Angka hasil hitungan
 * ditulis sebagai rumus Excel (dengan hasil tersimpan) supaya dapat diperiksa.
 */
import { PECAHAN } from '@/lib/closing'
import { parseAngka } from '@/lib/format'
import { rekapTeraNozzle, type BarisPumpTest } from '@/lib/pumptest'
import { CASH_SO, hitungArus, hitungCashSo, hitungNozzle, hitungTangki, JABATAN_SO, NON_TUNAI_SO, penerimaanBulan, tangkiKosong, terbilang, type SoData } from '@/lib/so'
import type { Dispenser, Nozzle, ReportSummary, Settings } from '@/lib/sop'
import type { Tank } from '@/lib/tank'
import type { TotalizerRecord } from '@/lib/totalizer'
import { Lembar, ref, tulisXlsx, type Gaya, type Nilai } from './xlsx-tulis'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const labelBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`
const tglPanjang = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const ddmmyyyy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
const angka = (s: string | undefined) => parseAngka(s ?? '')

const H: Gaya = { b: true, border: true, align: 'center', wrap: true, fill: true }
const T: Gaya = { border: true }
const TC: Gaya = { border: true, align: 'center' }
const N0: Gaya = { border: true, fmt: 'int' }
const N1: Gaya = { border: true, fmt: 'dec1' }
const N2: Gaya = { border: true, fmt: 'dec2' }
const RP: Gaya = { border: true, fmt: 'rp' }
const B: Gaya = { b: true }
const JUDUL: Gaya = { b: true, sz: 12 }

export interface SoExport {
  bulan: string
  settings: Settings
  data: SoData
  lalu: SoData | null
  tanks: Tank[]
  nozzles: Nozzle[]
  dispensers: Dispenser[]
  totalizer: TotalizerRecord[]
  reports: ReportSummary[]
  pumpTest: BarisPumpTest[]
}

function kepala(l: Lembar, x: SoExport, judul: string) {
  l.set('B2', 'SPBU :', B).set('C2', x.settings.namaSpbu || '-')
  l.set('B3', 'Bulan :', B).set('C3', labelBulan(x.bulan))
  l.set('B5', judul, JUDUL)
}

/** Kolom tanda tangan: Dibuat (pengawas, admin) & Diketahui (ABH); BA cash: Dihitung kasir. */
function tandaTangan(l: Lembar, x: SoExport, baris: number, kasir = false) {
  const t = x.data.ttd
  const kol = kasir
    ? [
        ['C', 'Dihitung Oleh,', t.kasir, 'Kasir'],
        ['E', 'Diketahui Oleh,', t.pengawas, 'Pengawas BBM'],
        ['G', '', t.admin, 'Administrasi'],
        ['J', 'Disetujui Oleh,', t.abh, 'ABH'],
      ]
    : [
        ['C', 'Dibuat Oleh,', t.pengawas, 'Pengawas BBM'],
        ['G', '', t.admin, 'Administrasi'],
        ['J', 'Diketahui Oleh,', t.abh, 'ABH'],
      ]
  for (const [c, judul, nama, jab] of kol) {
    if (judul) l.set(`${c}${baris}`, judul)
    l.set(`${c}${baris + 5}`, nama || '(..............................)', { b: true })
    l.set(`${c}${baris + 6}`, jab)
  }
}

function penutup(l: Lembar, baris: number, nama: string) {
  l.set(`B${baris}`, `Demikianlah Berita Acara ${nama} ini dibuat dengan sebenar – benarnya dan dapat dipertanggungjawabkan.`)
  l.set(`B${baris + 1}`, 'Berita Acara ini dapat di tinjau kembali apabila :')
  l.set(`B${baris + 2}`, '1.  Terdapat informasi yang tidak disampaikan dalam Berita Acara.')
  l.set(`B${baris + 3}`, '2.  Terdapat tindak pidana dan atau perbuatan merugikan Perusahaan & melanggar hukum.')
}

function daftarIsi(x: SoExport) {
  const l = new Lembar('Daftar Isi').kolom({ A: 3, B: 16, C: 5, D: 60 })
  l.set('B3', 'BERITA ACARA LAPORAN BULANAN', JUDUL)
  l.set('B4', 'Nama SPBU').set('C4', ':').set('D4', x.settings.namaSpbu || '-')
  l.set('B5', 'NO. SPBU').set('C5', ':').set('D5', x.settings.kodeSpbu || '-')
  l.set('B6', 'Periode SO/CO').set('C6', ':').set('D6', labelBulan(x.bulan))
  if (x.data.tanggalSo) l.set('B7', 'Tanggal SO').set('C7', ':').set('D7', `${tglPanjang(x.data.tanggalSo)} ${x.data.jamSo}`)
  const isi = [
    'Berita Acara Stock Opname BBM & Posisi Stand Meter Listrik',
    'Berita Acara Totalisator',
    'Berita Acara Arus Minyak',
    'Berita Acara Penerimaan BBM&BBK',
    'Berita Acara Rekap Terra Nozzle',
    'Berita Acara Cash Opname Penjualan BBM&BBK',
    'Berita Acara Cash Opname Penjualan LPG',
    'Berita Acara Cash Opname Penjualan Enduro Express',
    'Berita Acara Cash Opname Petty Cash',
    'Justifikasi Kenaikan / Penurunan Sales, Losses & Pertamina Way',
    'Update Pekerja SPBU',
  ]
  isi.forEach((s, i) => l.set(`C${10 + i}`, i + 1).set(`D${10 + i}`, s))
  tandaTangan(l, x, 23)
  return l
}

function baSo(x: SoExport) {
  const l = new Lembar('BA SO BBM').kolom({ A: 2, B: 11, C: 16, D: 13, E: 10, F: 11, G: 12, H: 11, I: 12, J: 13, K: 13, L: 13 })
  kepala(l, x, '1. Berita Acara Stock Opname Tangki Pendam')
  l.merge('B6:B7', 'No Urut Tangki Pendam', H).merge('C6:C7', 'Produk', H).merge('D6:D7', 'Kapasitas Tangki Pendam (Ltr)', H).merge('E6:E7', 'Tinggi Air (cm)', H)
  l.merge('F6:G6', 'Dipping Manual', H).merge('H6:I6', 'ATG', H)
  l.merge('J6:J7', 'Selisih D t Thd Manual (e = a − c)', H).merge('K6:K7', '** Konsistensi (YA / TIDAK)', H).merge('L6:L7', '*** VOLUME (Liter)', H)
  l.baris('F7', ['Tinggi (Cm) a', 'Volume (Ltr) b', 'Tinggi (Cm) c', 'Volume (Ltr) d'], H)
  let r = 8
  const awalLalu = 8 + x.tanks.length + 3
  x.tanks.forEach((t, i) => {
    const s = x.data.tangki[t.id] ?? tangkiKosong()
    const h = hitungTangki(s)
    const rl = awalLalu + 3 + i
    l.baris(`B${r}`, [i + 1, t.produk], TC)
    l.set(`D${r}`, t.capacity || null, N0).set(`E${r}`, angka(s.airCm), N1).set(`F${r}`, angka(s.dipCm), N1).set(`G${r}`, angka(s.dipL), N0).set(`H${r}`, angka(s.atgCm), N1).set(`I${r}`, angka(s.atgL), N0)
    l.set(`J${r}`, { f: `IF(AND(ISNUMBER(F${r}),ISNUMBER(H${r})),F${r}-H${r},"")`, v: h.selisih ?? '' }, N2)
    l.set(`K${r}`, { f: `IF(H${rl}="",IF(J${r}="","",IF(ABS(J${r})<=2.5,"YA","TIDAK")),IF(ABS(H${rl})<=2.5,"YA","TIDAK"))`, v: h.konsisten === null ? '' : h.konsisten ? 'YA' : 'TIDAK' }, TC)
    l.set(`L${r}`, { f: `IF(K${r}="TIDAK",G${r},IF(ISNUMBER(I${r}),I${r},G${r}))`, v: h.volume ?? '' }, N0)
    r++
  })
  r = awalLalu
  l.set(`B${r}`, 'Referensi data historis stok opname sebelumnya (t-1) :', B)
  r++
  l.merge(`B${r}:B${r + 1}`, 'No Urut Tangki Pendam', H).merge(`C${r}:C${r + 1}`, 'Produk', H).merge(`D${r}:E${r}`, 'Tinggi Level SO lalu', H).merge(`F${r}:G${r + 1}`, 'Selisih (D t-1) SO lalu (cm)', H).merge(`H${r}:I${r + 1}`, '** Konsistensi Selisih (Dt) − (Dt-1) (cm)', H)
  l.baris(`D${r + 1}`, ['Dipping (Cm)', 'ATG (Cm)'], H)
  r += 2
  x.tanks.forEach((t, i) => {
    const s = x.data.tangki[t.id] ?? tangkiKosong()
    const h = hitungTangki(s)
    l.baris(`B${r}`, [i + 1, t.produk], TC)
    l.set(`D${r}`, angka(s.laluDipCm), N1).set(`E${r}`, angka(s.laluAtgCm), N1)
    l.merge(`F${r}:G${r}`, { f: `IF(AND(ISNUMBER(D${r}),ISNUMBER(E${r})),D${r}-E${r},"")`, v: h.selisihLalu ?? '' }, N2)
    l.merge(`H${r}:I${r}`, { f: `IF(AND(ISNUMBER(J${8 + i}),ISNUMBER(F${r})),J${8 + i}-F${r},"")`, v: h.konsistensiCm ?? '' }, N2)
    r++
  })
  const tglLalu = x.tanks.map((t) => x.data.tangki[t.id]?.laluTanggal).find(Boolean)
  if (tglLalu) l.set(`J${awalLalu + 1}`, `Tgl SO lalu: ${ddmmyyyy(tglLalu)}`)
  r++
  l.merge(`B${r}:L${r + 1}`, '** Jika ATG telah di adjusting maka batasan konsistensi selisih langsung dari selisih (Dt) dan konsistensi antar waktu [(D t) − (D t-1)]; jika belum, batasannya hanya konsistensi antar waktu. Batas maksimal |2,5 cm| = |25 mm|.', { wrap: true, valign: 'top' })
  r += 2
  l.merge(`B${r}:L${r + 1}`, '*** Jika pembacaan ATG konsisten (YA) dipakai volume ATG; jika TIDAK konsisten dipakai volume dipping manual.', { wrap: true, valign: 'top' })
  r += 2
  l.set(`B${r}`, `Catatan: ${x.data.catatanAtg || '-'}`)
  r += 2
  l.set(`B${r}`, 'Posisi Meter Listrik', JUDUL)
  r++
  l.merge(`B${r}:C${r}`, 'Awal Bulan (a)', H).merge(`D${r}:E${r}`, 'Akhir Bulan (b)', H).merge(`F${r}:G${r}`, 'Total Pemakaian (c = b − a)', H)
  r++
  const la = angka(x.data.listrikAwal)
  const lb = angka(x.data.listrikAkhir)
  l.merge(`B${r}:C${r}`, la, N2).merge(`D${r}:E${r}`, lb, N2).merge(`F${r}:G${r}`, { f: `IF(AND(ISNUMBER(B${r}),ISNUMBER(D${r})),D${r}-B${r},"")`, v: la !== null && lb !== null ? lb - la : '' }, N2)
  r += 2
  penutup(l, r, 'Stock Opname')
  tandaTangan(l, x, r + 5)
  return l
}

function baTotalisator(x: SoExport) {
  const l = new Lembar('BA Totalisator').kolom({ A: 2, B: 10, C: 9, D: 16, E: 12, F: 14, G: 14, H: 13, I: 14, J: 14, K: 13, L: 11 })
  kepala(l, x, '2. Posisi Totalisator / Meter Pompa Dispenser')
  l.merge('B6:B7', 'No Disp', H).merge('C6:C7', 'No Nozzle', H).merge('D6:D7', 'Produk', H).merge('E6:E7', 'Keterangan R4/R2', H)
  l.merge('F6:H6', 'Totalisator Manual', H).merge('I6:K6', 'Totalisator Digital', H).merge('L6:L7', 'Selisih g = (f − c)', H)
  l.baris('F7', ['Awal a', 'Akhir b', 'Total Sales c = (b − a)', 'Awal d', 'Akhir e', 'Total Sales f = (e − d)'], H)
  let r = 8
  const awal = r
  const urut = [...x.nozzles].sort((a, b) => {
    const da = x.dispensers.findIndex((d) => d.id === a.dispenserId)
    const db = x.dispensers.findIndex((d) => d.id === b.dispenserId)
    return (da < 0 ? 999 : da) - (db < 0 ? 999 : db) || a.nama.localeCompare(b.nama, 'id', { numeric: true })
  })
  let dispSebelum = ''
  for (const nz of urut) {
    const d = x.data.nozzle[nz.id]
    const h = hitungNozzle(nz, d, x.totalizer)
    const disp = x.dispensers.find((z) => z.id === nz.dispenserId)
    l.set(`B${r}`, disp && disp.id !== dispSebelum ? disp.nama.replace(/^dispenser\s*/i, '') : '', TC)
    dispSebelum = disp?.id ?? ''
    l.baris(`C${r}`, [nz.nama, nz.produk, d?.keterangan || ''], TC)
    l.set(`F${r}`, h.mAwal, N2).set(`G${r}`, h.mAkhir, N2).set(`H${r}`, { f: `IF(AND(ISNUMBER(F${r}),ISNUMBER(G${r})),G${r}-F${r},"")`, v: h.manual ?? '' }, N2)
    l.set(`I${r}`, h.dAwal, N2).set(`J${r}`, h.dAkhir, N2).set(`K${r}`, { f: `IF(AND(ISNUMBER(I${r}),ISNUMBER(J${r})),J${r}-I${r},"")`, v: h.digital ?? '' }, N2)
    l.set(`L${r}`, { f: `IF(AND(ISNUMBER(H${r}),ISNUMBER(K${r})),K${r}-H${r},"")`, v: h.selisih ?? '' }, N2)
    r++
  }
  l.merge(`F${r}:G${r}`, 'Total Sales', { ...H })
  l.set(`H${r}`, { f: `SUM(H${awal}:H${r - 1})` }, { ...N2, b: true }).set(`K${r}`, { f: `SUM(K${awal}:K${r - 1})` }, { ...N2, b: true }).set(`L${r}`, { f: `SUM(L${awal}:L${r - 1})` }, { ...N2, b: true })
  r += 2
  l.merge(`B${r}:L${r + 3}`, `Catatan:\n1. Totalisator digital ditarik dari modul Totalizer FLOQ (awal shift 1 tanggal 1, akhir shift terakhir bulan ini) kecuali diubah manual.\n2. Jika totalisator manual maupun digital mengalami kerusakan agar dicantumkan sebagai catatan.\n3. Keterangan R4/R2/R4 Red Carpet/R2 Self Service wajib diisi per nozzle.${x.data.catatanTotalisator ? `\n${x.data.catatanTotalisator}` : ''}`, { wrap: true, valign: 'top' })
  r += 5
  penutup(l, r, 'Posisi Totalisator')
  tandaTangan(l, x, r + 5)
  return l
}

function produkSo(x: SoExport) {
  const ada = new Set([...x.tanks.map((t) => t.produk), ...x.nozzles.map((n) => n.produk)])
  return [...ada]
}

function baArus(x: SoExport) {
  const l = new Lembar('BA Arus Minyak').kolom({ A: 2, B: 40 })
  kepala(l, x, '3. Arus Minyak')
  const produk = produkSo(x)
  const penerimaan = penerimaanBulan(x.reports, x.bulan)
  l.merge('B6:B7', 'Keterangan', H)
  const kol = (i: number) => String.fromCharCode(67 + i)
  if (produk.length) l.merge(`C6:${kol(produk.length - 1)}6`, 'Produk', H)
  produk.forEach((p, i) => {
    l.set(`${kol(i)}7`, p, H)
    l.lebar[3 + i] = 15
  })
  const label = ['Stock Awal (a)', 'Penerimaan (b)', 'Jumlah (c = a + b)', 'Penjualan bersih stlh dikurangi tera (d)', 'Stock Akhir Teoritis (e = c − d)', 'Stok Akhir Real ATG/Dipping (f)', 'Losses (g = f − e)', '% Losses (h = g / d × 100)']
  label.forEach((s, i) => l.set(`B${8 + i}`, s, T))
  produk.forEach((p, i) => {
    const c = kol(i)
    const a = hitungArus(p, { tanks: x.tanks, data: x.data, lalu: x.lalu, totalizer: x.totalizer, nozzles: x.nozzles, penerimaan, pumpTest: x.pumpTest })
    l.set(`${c}8`, a.a, N2).set(`${c}9`, a.b, N2)
    l.set(`${c}10`, { f: `IF(ISNUMBER(${c}8),${c}8+${c}9,"")`, v: a.c ?? '' }, N2)
    l.set(`${c}11`, a.d, N2)
    l.set(`${c}12`, { f: `IF(AND(ISNUMBER(${c}10),ISNUMBER(${c}11)),${c}10-${c}11,"")`, v: a.e ?? '' }, N2)
    l.set(`${c}13`, a.f, N2)
    l.set(`${c}14`, { f: `IF(AND(ISNUMBER(${c}13),ISNUMBER(${c}12)),${c}13-${c}12,"")`, v: a.g ?? '' }, N2)
    l.set(`${c}15`, { f: `IF(AND(ISNUMBER(${c}14),N(${c}11)<>0),${c}14/${c}11*100,"")`, v: a.h ?? '' }, { ...N2, fmt: 'pct' })
  })
  l.merge('B17:J19', 'Catatan:\n(a) dari stok akhir real SO bulan lalu, (b) volume order penerimaan BBM (Input Bongkaran), (d) penjualan totalisator digital dikurangi pump test/tera, (f) volume SO tangki (ATG bila konsisten, selain itu dipping manual).', { wrap: true, valign: 'top' })
  tandaTangan(l, x, 22)
  return l
}

function baPenerimaan(x: SoExport) {
  const l = new Lembar('BA Penerimaan BBM&BBK').kolom({ A: 2, B: 12, C: 13, D: 18, E: 14, F: 16, G: 14, H: 15, I: 14, J: 9 })
  kepala(l, x, '4. Berita Acara Penerimaan BBM & BBK')
  const semua = penerimaanBulan(x.reports, x.bulan)
  const produk = [...new Set([...produkSo(x), ...semua.map((s) => s.r.produk)])]
  let r = 6
  const resume: { p: string; tot: number }[] = []
  for (const p of produk) {
    const rows = semua.filter((s) => s.r.produk === p)
    l.set(`B${r}`, p, B)
    r++
    l.baris(`B${r}`, ['Tanggal', 'No Polisi', 'Nama Supir', 'No.SO', 'No.DO (LO)', 'Volume Order (Liter) a', 'Real Penerimaan (Liter) b', 'Discharge Losses c = b − a', '%'], H)
    r++
    const awal = r
    for (const s of rows) {
      l.baris(`B${r}`, [ddmmyyyy(s.r.tanggal), s.r.nopol, s.r.namaDriver ?? '', s.r.noSO, s.r.noLOs.join(', ')], T)
      l.set(`G${r}`, s.order, N0).set(`H${r}`, s.real, N2)
      l.set(`I${r}`, { f: `IF(ISNUMBER(H${r}),H${r}-G${r},"")`, v: s.real === null ? '' : s.real - s.order }, N2)
      l.set(`J${r}`, { f: `IF(AND(ISNUMBER(I${r}),G${r}<>0),I${r}/G${r}*100,"")`, v: s.real === null || !s.order ? '' : ((s.real - s.order) / s.order) * 100 }, { ...N2, fmt: 'pct' })
      r++
    }
    if (!rows.length) {
      l.merge(`B${r}:J${r}`, 'Tidak ada penerimaan', { ...T, align: 'center', italic: true })
      r++
    }
    l.merge(`B${r}:F${r}`, 'Total', { ...H })
    if (rows.length) {
      l.set(`G${r}`, { f: `SUM(G${awal}:G${r - 1})` }, { ...N0, b: true }).set(`H${r}`, { f: `SUM(H${awal}:H${r - 1})` }, { ...N2, b: true }).set(`I${r}`, { f: `H${r}-G${r}` }, { ...N2, b: true }).set(`J${r}`, { f: `IF(G${r}<>0,I${r}/G${r}*100,"")` }, { ...N2, b: true, fmt: 'pct' })
      resume.push({ p, tot: r })
    }
    r += 2
  }
  l.baris(`B${r}`, ['Resume', 'Produk', 'Total Penerimaan DO', 'Total Real Penerimaan', 'Discharge Losses', '%'], H)
  r++
  const awalRes = r
  for (const p of produk) {
    const x0 = resume.find((z) => z.p === p)
    l.set(`B${r}`, '', T).set(`C${r}`, p, T)
    l.set(`D${r}`, x0 ? { f: `G${x0.tot}` } : 0, N0).set(`E${r}`, x0 ? { f: `H${x0.tot}` } : 0, N2).set(`F${r}`, { f: `E${r}-D${r}` }, N2).set(`G${r}`, { f: `IF(D${r}<>0,F${r}/D${r}*100,"")` }, { ...N2, fmt: 'pct' })
    r++
  }
  l.set(`B${r}`, '', H).set(`C${r}`, 'TOTAL', H).set(`D${r}`, { f: `SUM(D${awalRes}:D${r - 1})` }, { ...N0, b: true }).set(`E${r}`, { f: `SUM(E${awalRes}:E${r - 1})` }, { ...N2, b: true }).set(`F${r}`, { f: `E${r}-D${r}` }, { ...N2, b: true }).set(`G${r}`, { f: `IF(D${r}<>0,F${r}/D${r}*100,"")` }, { ...N2, b: true, fmt: 'pct' })
  r += 2
  penutup(l, r, 'Penerimaan BBM & BBK')
  tandaTangan(l, x, r + 5)
  return l
}

function baTera(x: SoExport) {
  const hari = new Date(Number(x.bulan.slice(0, 4)), Number(x.bulan.slice(5, 7)), 0).getDate()
  const l = new Lembar('BA Rekap Terra Nozzle').kolom({ A: 2, B: 8, C: 9, D: 18 })
  kepala(l, x, '5. Berita Acara Rekap Terra Nozzle / Density (liter pump test per hari)')
  const kolHari = (d: number) => 4 + d
  l.merge('B7:B8', 'No Disp', H).merge('C7:C8', 'No Nozzle', H).merge('D7:D8', 'Produk', H)
  l.merge(`${ref(kolHari(1), 7)}:${ref(kolHari(hari), 7)}`, 'Tanggal', H)
  for (let d = 1; d <= hari; d++) {
    l.set(ref(kolHari(d), 8), d, H)
    l.lebar[kolHari(d)] = 5
  }
  const total = kolHari(hari) + 1
  l.merge(`${ref(total, 7)}:${ref(total, 8)}`, 'Total Terra Nozzle', H)
  l.lebar[total] = 12
  const rekap = rekapTeraNozzle(x.pumpTest)
  // Semua nozzle data utama tampil walau tanpa pump test; nozzle tidak dicatat di baris terpisah.
  const baris = [
    ...x.nozzles.map((n) => ({ n, rk: rekap.find((z) => z.nozzle === n.nama && z.produk === n.produk) })),
    ...rekap.filter((z) => !x.nozzles.some((n) => n.nama === z.nozzle && n.produk === z.produk)).map((rk) => ({ n: null as Nozzle | null, rk })),
  ]
  let r = 9
  for (const { n, rk } of baris) {
    const disp = x.dispensers.find((d) => d.id === n?.dispenserId)
    l.set(`B${r}`, disp ? disp.nama.replace(/^dispenser\s*/i, '') : '', TC).set(`C${r}`, n?.nama ?? (rk?.nozzle || '-'), TC).set(`D${r}`, n?.produk ?? rk?.produk ?? '', T)
    for (let d = 1; d <= hari; d++) {
      const v = rk?.perHari.get(`${x.bulan}-${String(d).padStart(2, '0')}`)
      l.set(ref(kolHari(d), r), v ?? null, { ...TC, fmt: 'dec1' })
    }
    l.set(ref(total, r), { f: `SUM(${ref(kolHari(1), r)}:${ref(kolHari(hari), r)})`, v: rk?.total ?? 0 }, { ...N1, b: true })
    r++
  }
  r += 2
  penutup(l, r, 'Rekap Terra Nozzle')
  tandaTangan(l, x, r + 5)
  return l
}

function baCash(x: SoExport, i: number) {
  const def = CASH_SO[i]
  const c = x.data.cash[def.key]
  const h = hitungCashSo(c, def.key)
  const l = new Lembar(def.sheet).kolom({ A: 2, B: 3, C: 40, D: 12, E: 10, F: 18, G: 16 })
  kepala(l, x, `${def.no}. ${def.judul}`)
  const tgl = x.data.tanggalSo
  const d = tgl ? new Date(`${tgl}T00:00:00`) : null
  const objek = def.key === 'petty' ? 'Petty Cash' : def.judul.replace('Berita Acara Cash Opname ', '')
  l.merge(
    'B6:G7',
    `Pada hari ini ${d ? `${HARI[d.getDay()]} tanggal ${tglPanjang(tgl)}` : '.......... tanggal ..........'} jam ${x.data.jamSo || '..:..'}, telah dilakukan pemeriksaan hasil uang fisik ${objek.toLowerCase()} tanggal ${c.tanggal ? tglPanjang(c.tanggal) : '..........'} dengan rincian sebagai berikut :`,
    { wrap: true, valign: 'top' },
  )
  l.set('B8', 'a. Rincian Hasil Pemeriksaan', B)
  let r = 9
  const awal = r
  if (def.key === 'petty') {
    l.set(`C${r}`, 'Saldo Per Book (Catatan Kasir)', T).set(`F${r}`, angka(c.penjualan) ?? 0, RP)
    r++
  } else {
    l.set(`C${r}`, `Transaksi Penjualan${c.tanggal ? ` tanggal ${tglPanjang(c.tanggal)}` : ''}`, T).set(`F${r}`, angka(c.penjualan) ?? 0, RP)
    r++
    const daftar = def.key === 'bbm' ? NON_TUNAI_SO : ['Transaksi Non Tunai']
    for (const k of daftar) {
      l.set(`C${r}`, def.key === 'bbm' ? `Transaksi Non Cash ${k}` : k, T).set(`F${r}`, angka(c.nonTunai[def.key === 'bbm' ? k : 'non_tunai']) ?? 0, RP)
      r++
    }
    l.set(`C${r}`, 'Total Penjualan Tunai', { ...T, b: true }).set(`F${r}`, { f: `F${awal}-SUM(F${awal + 1}:F${r - 1})`, v: h.seharusnya }, { ...RP, b: true })
    r++
  }
  const baris = r
  l.set(`C${r}`, def.key === 'petty' ? 'Saldo Hasil Cash Opname' : 'Hasil Cash Opname', T).set(`F${r}`, { f: `F${r + 6 + PECAHAN.length}`, v: h.fisik }, RP)
  r++
  l.set(`C${r}`, 'Selisih', { ...T, b: true }).set(`F${r}`, { f: `F${baris}-F${baris - 1}`, v: h.selisih }, { ...RP, b: true }).set(`G${r}`, 'Lebih / (Kurang)')
  r += 2
  l.set(`B${r}`, 'b. Rincian Uang', B)
  r++
  l.baris(`C${r}`, ['Keterangan', 'Pecahan', 'Qty', 'Total'], H)
  r++
  const awalP = r
  PECAHAN.forEach(([k, , v, t], j) => {
    const q = angka(c.pecahan[k]) ?? 0
    l.set(`C${r}`, j === 0 ? 'Uang Kertas' : t === 'l' && PECAHAN[j - 1][3] === 'k' ? 'Uang Logam' : '', T).set(`D${r}`, v, N0).set(`E${r}`, q, N0).set(`F${r}`, { f: `D${r}*E${r}`, v: q * v }, RP)
    r++
  })
  l.set(`C${r}`, '', T).set(`D${r}`, 'TOTAL', { ...TC, b: true }).set(`E${r}`, { f: `SUM(E${awalP}:E${r - 1})` }, { ...N0, b: true }).set(`F${r}`, { f: `SUM(F${awalP}:F${r - 1})`, v: h.fisik }, { ...RP, b: true })
  r += 2
  l.set(`C${r}`, `Terbilang : ${terbilang(h.fisik)}`, { italic: true })
  r += 2
  penutup(l, r, def.key === 'petty' ? 'Pemeriksaan Petty Cash' : 'Cash Opname')
  tandaTangan(l, x, r + 5, true)
  return l
}

function justifikasi(x: SoExport) {
  const l = new Lembar('Justifikasi Sales & Losses & PW').kolom({ A: 2, B: 100 })
  kepala(l, x, '10. Justifikasi Kenaikan/Penurunan Sales, Losses & Pertamina Way')
  const isi: [string, string][] = [
    ['a. Justifikasi Sales', x.data.justifikasiSales],
    ['b. Justifikasi Losses', x.data.justifikasiLosses],
    ['c. Justifikasi Pertamina Way', x.data.justifikasiPw],
  ]
  let r = 6
  for (const [j, t] of isi) {
    l.set(`B${r}`, j, B)
    l.merge(`B${r + 1}:B${r + 5}`, t || '-', { wrap: true, valign: 'top' })
    r += 7
  }
  tandaTangan(l, x, r + 1)
  return l
}

function pekerja(x: SoExport) {
  const l = new Lembar('Update Pekerja SPBU').kolom({ A: 2, B: 6, C: 26, D: 16 })
  kepala(l, x, '11. Update Pekerja SPBU')
  l.baris('B6', ['No', 'Jabatan', 'Jumlah Pekerja'], H)
  let r = 7
  const lain = Object.keys(x.data.pekerja).filter((k) => !JABATAN_SO.includes(k))
  ;[...JABATAN_SO, ...lain].forEach((j, i) => {
    const v = angka(x.data.pekerja[j])
    l.set(`B${r}`, i + 1, TC).set(`C${r}`, j, T).set(`D${r}`, v ?? '-', { ...TC, fmt: 'int' })
    r++
  })
  l.set(`B${r}`, '', H).set(`C${r}`, 'TOTAL', H).set(`D${r}`, { f: `SUM(D7:D${r - 1})` }, { ...N0, b: true, align: 'center' })
  r += 2
  penutup(l, r, 'Pemeriksaan Update Pekerja')
  tandaTangan(l, x, r + 5)
  return l
}

export async function soXlsx(x: SoExport): Promise<Blob> {
  const lembar: Lembar[] = [daftarIsi(x), baSo(x), baTotalisator(x), baArus(x), baPenerimaan(x), baTera(x), ...CASH_SO.map((_, i) => baCash(x, i)), justifikasi(x), pekerja(x)]
  return tulisXlsx(lembar)
}

/** Nilai sel untuk pratinjau di aplikasi (angka atau "-"). */
export const nilaiTampil = (v: Nilai) => (v === null || v === undefined ? '-' : typeof v === 'object' ? String(v.v ?? '-') : String(v))
