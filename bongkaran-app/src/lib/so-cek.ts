/**
 * Generate Laporan SO 1 klik: periksa kelengkapan data tarikan (tanggal 1 s.d. akhir bulan) dan isian hari SO,
 * isi otomatis dari modul lain (closing shift, water content, personil, SO bulan lalu), lalu ringkas angka
 * yang akan masuk ke BA Laporan Bulanan. Item "wajib" menahan generate; item "saran" hanya peringatan.
 */
import type { AirRecord } from '@/lib/air'
import type { ClosingRecord, NonTunaiKey } from '@/lib/closing'
import type { DailyRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { personilAktif } from '@/lib/personil'
import type { BarisPumpTest } from '@/lib/pumptest'
import { currentShift, type Shift } from '@/lib/shift'
import { hitungArus, hitungCashSo, JABATAN_SO, kosongCash, nozzleKosong, penerimaanBulan, tangkiKosong, type SoData } from '@/lib/so'
import type { Nozzle, ReportSummary, Settings } from '@/lib/sop'
import type { Tank } from '@/lib/tank'
import { totalizerLengkap, type TotalizerRecord } from '@/lib/totalizer'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglPendek = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]}`
const isi = (s: string | undefined) => parseAngka(s ?? '') !== null

export const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
export const bulanDepan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 1))

/** Semua tanggal bulan ini (YYYY-MM-DD). */
export function tanggalBulan(bulan: string) {
  const out: string[] = []
  for (let d = new Date(`${bulan}-01T00:00:00`); todayIso(d) <= akhirBulan(bulan); d = addDays(d, 1)) out.push(todayIso(d))
  return out
}

/** Bagian isian SO di halaman (nomor kartu BA). */
export type BagianSo = 1 | 2 | 3 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export interface ItemCek {
  key: string
  judul: string
  /** Ringkasan, mis. "88 dari 93 shift". */
  detail: string
  ok: boolean
  /** Daftar yang belum (tanggal/shift, nama tangki, dsb.). */
  kurang: string[]
  /** Tautan halaman pengisian (modul lain) atau bagian isian SO di halaman ini. */
  to?: string
  bagian?: BagianSo
  /** Sumber data di BA, mis. "BA Totalisator & Arus Minyak". */
  untuk: string
}

/** Pemetaan jabatan personil (modul Personil) → jabatan BA Update Pekerja. */
const JABATAN_KE_SO: Record<string, string> = {
  Pengawas: 'Pws. BBM',
  'Kepala Shift': 'Ka. Shift',
  Operator: 'Pramuniaga (Opr)',
  Kasir: 'Kasir',
  'Admin / Cashier': 'Admin BOS',
  Security: 'Security',
  'Cleaning Service': 'Cleaning Service',
  Teknisi: 'Mekanik BOM',
}
/** Non tunai closing shift (One Touch) → rincian BA cash opname BBM. */
const NON_TUNAI_KE_SO: Record<NonTunaiKey, string> = {
  edc_bca: 'EDC BCA',
  edc_bri: 'EDC BRI',
  edc_mandiri: 'EDC Mandiri',
  edc_bni: 'EDC BNI',
  myp_linkaja: 'EDC Link Aja',
  rfid: 'Customer Card',
  e_voucher: 'Voucher',
  p_voucher: 'Voucher',
}

export interface SumberSo {
  bulan: string
  settings: Settings
  tanks: Tank[]
  nozzles: Nozzle[]
  /** SO bulan lalu (stok awal, D t-1, totalisator manual awal, keterangan R2/R4). */
  lalu: SoData | null
  totalizer: TotalizerRecord[]
  closing: ClosingRecord[]
  air: AirRecord[]
  daily: DailyRecord[]
  reports: ReportSummary[]
}

/**
 * Isian SO efektif: isian tersimpan + tarikan otomatis untuk kolom yang masih kosong.
 * Tidak menimpa isian pengguna.
 */
export function lengkapiOtomatis(d: SoData, s: SumberSo): { data: SoData; otomatis: string[] } {
  const otomatis: string[] = []
  const akhir = akhirBulan(s.bulan)
  const tanggalSo = d.tanggalSo || bulanDepan(s.bulan)

  // Tinggi air tangki: water content tanggal SO (atau catatan terakhir bulan ini).
  const airSo = [...s.air].filter((r) => r.tanggal <= tanggalSo).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0]
  let pakaiAir = false
  const tangki = Object.fromEntries(
    s.tanks.map((t) => {
      const x = { ...tangkiKosong(), ...d.tangki[t.id] }
      const l = s.lalu?.tangki[t.id]
      const mm = parseAngka(airSo?.data.tangki[t.id]?.airMm ?? '')
      if (!x.airCm && mm !== null) {
        x.airCm = String(Math.round(mm) / 10)
        pakaiAir = true
      }
      return [
        t.id,
        {
          ...x,
          laluDipCm: x.laluDipCm || l?.dipCm || '',
          laluAtgCm: x.laluAtgCm || l?.atgCm || '',
          laluTanggal: x.laluTanggal || s.lalu?.tanggalSo || '',
        },
      ]
    }),
  )
  if (pakaiAir && airSo) otomatis.push(`Tinggi air tangki dari Water Content ${tglPendek(airSo.tanggal)}`)

  // Totalisator manual awal & keterangan R2/R4 dari SO bulan lalu.
  let pakaiLaluNz = false
  const nozzle = Object.fromEntries(
    s.nozzles.map((nz) => {
      const x = { ...nozzleKosong(), ...d.nozzle[nz.id] }
      const l = s.lalu?.nozzle[nz.id]
      if (!x.manualAwal && l?.manualAkhir) {
        x.manualAwal = l.manualAkhir
        pakaiLaluNz = true
      }
      if (!x.keterangan && l?.keterangan) x.keterangan = l.keterangan
      return [nz.id, x]
    }),
  )
  if (pakaiLaluNz) otomatis.push('Totalisator manual awal dari totalisator manual akhir SO bulan lalu')

  // Cash opname: tanggal & angka transaksi dari closing shift hari terakhir bulan ini (uang fisik tetap dihitung saat SO).
  const tglClosing = [...s.closing]
    .map((r) => r.tanggal)
    .filter((t) => t <= akhir)
    .sort()
    .at(-1)
  const cash = { ...d.cash }
  if (tglClosing) {
    const hari = s.closing.filter((r) => r.tanggal === tglClosing)
    const bbm = hari.reduce((n, r) => n + r.data.penjualan.reduce((m, p) => m + (p.rupiah ?? 0), 0) + (r.data.nonFuel.bbk_kemasan || 0), 0)
    const lpg = hari.reduce((n, r) => n + (r.data.nonFuel.lpg || 0), 0)
    const enduro = hari.reduce((n, r) => n + (r.data.nonFuel.enduro || 0), 0)
    const nonTunai: Record<string, string> = {}
    for (const r of hari)
      for (const [k, v] of Object.entries(r.data.nonTunai) as [NonTunaiKey, number][]) {
        const kunci = NON_TUNAI_KE_SO[k]
        if (kunci && v) nonTunai[kunci] = String((parseAngka(nonTunai[kunci] ?? '') ?? 0) + v)
      }
    const tarik = (k: 'bbm' | 'lpg' | 'enduro', jual: number, nt: Record<string, string>) => {
      const c = { ...kosongCash(), ...cash[k] }
      if (c.penjualan || !jual) return
      cash[k] = {
        ...c,
        tanggal: c.tanggal || tglClosing,
        penjualan: String(Math.round(jual)),
        nonTunai: Object.keys(c.nonTunai).length ? c.nonTunai : nt,
      }
      otomatis.push(`Transaksi cash opname ${k === 'bbm' ? 'BBM' : k === 'lpg' ? 'LPG' : 'Enduro'} dari Closing Shift ${tglPendek(tglClosing)} (${hari.length} shift)`)
    }
    tarik('bbm', bbm, nonTunai)
    tarik('lpg', lpg, {})
    tarik('enduro', enduro, {})
  }

  // Update pekerja dari daftar personil aktif.
  let pekerja = d.pekerja
  const aktif = personilAktif(s.settings)
  if (!Object.values(pekerja).some((v) => v.trim()) && aktif.length) {
    const hit: Record<string, number> = {}
    for (const p of aktif) {
      const j = JABATAN_KE_SO[p.jabatan] ?? (JABATAN_SO.includes(p.jabatan) ? p.jabatan : p.jabatan || 'Lainnya')
      hit[j] = (hit[j] ?? 0) + 1
    }
    pekerja = Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, String(v)]))
    otomatis.push(`Update pekerja dari Personil (${aktif.length} orang aktif)`)
  }

  const listrikAwal = d.listrikAwal || s.lalu?.listrikAkhir || ''
  if (!d.listrikAwal && s.lalu?.listrikAkhir) otomatis.push('Meter listrik awal dari meter akhir SO bulan lalu')

  return {
    data: {
      ...d,
      tanggalSo,
      listrikAwal,
      tangki,
      nozzle,
      cash,
      pekerja,
      ttd: {
        ...d.ttd,
        pengawas: d.ttd.pengawas || s.settings.namaPengawasDefault || '',
        abh: d.ttd.abh || s.settings.namaAbhDefault || '',
      },
    },
    otomatis,
  }
}

const SHIFT: Shift[] = [1, 2, 3]

/** Daftar periksa kelengkapan untuk generate SO. `data` = isian efektif (sesudah lengkapiOtomatis). */
export function cekSo(data: SoData, s: SumberSo, pumpTest: BarisPumpTest[], now = currentShift()) {
  const hari = tanggalBulan(s.bulan)
  // Hanya tanggal/shift yang sudah lewat atau sedang berjalan yang dinilai.
  const lewat = (tanggal: string, shift: Shift) => `${tanggal}#${shift}` <= `${now.tanggal}#${now.shift}`
  const slot = hari.flatMap((t) => SHIFT.filter((sh) => lewat(t, sh)).map((sh) => ({ t, sh })))
  const hariLewat = hari.filter((t) => t <= now.tanggal)
  const label = (t: string, sh?: Shift) => `${tglPendek(t)}${sh ? ` S${sh}` : ''}`
  const perShift = (key: string, judul: string, ada: (t: string, sh: Shift) => boolean, to: (t: string, sh: Shift) => string, untuk: string): ItemCek => {
    const kurang = slot.filter((x) => !ada(x.t, x.sh))
    return {
      key,
      judul,
      detail: `${slot.length - kurang.length} dari ${slot.length} shift`,
      ok: !kurang.length,
      kurang: kurang.map((x) => label(x.t, x.sh)),
      to: kurang[0] ? to(kurang[0].t, kurang[0].sh) : undefined,
      untuk,
    }
  }
  const perHari = (key: string, judul: string, ada: (t: string) => boolean, to: string, untuk: string): ItemCek => {
    const kurang = hariLewat.filter((t) => !ada(t))
    return {
      key,
      judul,
      detail: `${hariLewat.length - kurang.length} dari ${hariLewat.length} hari`,
      ok: !kurang.length,
      kurang: kurang.map((t) => label(t)),
      to,
      untuk,
    }
  }
  const daftar = (key: string, judul: string, kurang: string[], total: number, bagian: BagianSo, untuk: string, satuan = ''): ItemCek => ({
    key,
    judul,
    detail: total ? `${total - kurang.length} dari ${total}${satuan}` : 'Data utama belum ada',
    ok: total > 0 && !kurang.length,
    kurang: total ? kurang : ['Lengkapi data utama di Pengaturan SPBU'],
    bagian,
    untuk,
  })

  const tot = new Map(s.totalizer.map((r) => [`${r.tanggal}#${r.shift}`, r]))
  const closing = new Set(s.closing.map((r) => `${r.tanggal}#${r.shift}`))
  const stok = new Set(s.daily.filter((r) => r.kind === 'stok').map((r) => `${r.tanggal}#${r.shift}`))
  const qq = new Set(s.daily.filter((r) => r.kind === 'qq').map((r) => r.tanggal))
  const air = new Set(s.air.map((r) => r.tanggal))

  const wajib: ItemCek[] = []
  const saran: ItemCek[] = []

  wajib.push(
    perShift(
      'totalizer',
      'Totalizer awal & akhir setiap shift',
      (t, sh) => totalizerLengkap(tot.get(`${t}#${sh}`), s.nozzles),
      (t, sh) => `/totalizer/${t}/${sh}`,
      'BA Totalisator digital & penjualan Arus Minyak',
    ),
  )
  const draf = s.reports.filter((r) => r.status === 'draft' && (r.tanggalShift || r.tanggal).startsWith(s.bulan))
  wajib.push({
    key: 'bongkaran',
    judul: 'Laporan pembongkaran BBM diselesaikan',
    detail: draf.length ? `${draf.length} laporan masih draf` : `${penerimaanBulan(s.reports, s.bulan).length} penerimaan selesai`,
    ok: !draf.length,
    kurang: draf.map((r) => `${label(r.tanggal)} ${r.produk} ${r.nopol}`),
    to: draf[0] ? `/input/${draf[0].id}` : undefined,
    untuk: 'BA Penerimaan BBM & penerimaan Arus Minyak',
  })
  wajib.push(
    daftar(
      'tangki',
      'Dipping & ATG tangki pendam saat SO',
      s.tanks.filter((t) => !isi(data.tangki[t.id]?.dipCm) || !isi(data.tangki[t.id]?.atgCm) || !(isi(data.tangki[t.id]?.dipL) || isi(data.tangki[t.id]?.atgL))).map((t) => t.label),
      s.tanks.length,
      1,
      'BA SO BBM & stok akhir real Arus Minyak',
      ' tangki',
    ),
  )
  wajib.push(
    daftar(
      'listrik',
      'Meter listrik awal & akhir bulan',
      [...(isi(data.listrikAwal) ? [] : ['Meter awal']), ...(isi(data.listrikAkhir) ? [] : ['Meter akhir'])],
      2,
      1,
      'BA SO BBM (posisi meter listrik)',
    ),
  )
  wajib.push(
    daftar(
      'manual',
      'Totalisator manual (mekanik) awal & akhir',
      s.nozzles.filter((nz) => !isi(data.nozzle[nz.id]?.manualAwal) || !isi(data.nozzle[nz.id]?.manualAkhir)).map((nz) => `Nozzle ${nz.nama} ${nz.produk}`),
      s.nozzles.length,
      2,
      'BA Totalisator (selisih manual vs digital)',
      ' nozzle',
    ),
  )
  const produk = [...new Set([...s.tanks.map((t) => t.produk), ...s.nozzles.map((n) => n.produk)])]
  if (!s.lalu) {
    const kosong = produk.filter((p) => !isi(data.arus[p]?.stokAwal))
    wajib.push(daftar('stokawal', 'Stok awal bulan (belum ada SO bulan lalu)', kosong, produk.length, 3, 'Arus Minyak (a)', ' produk'))
  }
  const fisikBbm = hitungCashSo(data.cash.bbm ?? kosongCash(), 'bbm').fisik
  wajib.push({
    key: 'cash',
    judul: 'Cash opname BBM: hitung uang fisik',
    detail: fisikBbm ? 'Sudah dihitung' : 'Rincian pecahan belum diisi',
    ok: fisikBbm > 0,
    kurang: fisikBbm ? [] : ['Rincian uang (lembar/keping)'],
    bagian: 6,
    untuk: 'BA Cash Opname Penjualan BBM & BBK',
  })
  wajib.push(daftar('ttd', 'Nama penanda tangan BA', [...(data.ttd.pengawas.trim() ? [] : ['Pengawas BBM']), ...(data.ttd.abh.trim() ? [] : ['ABH'])], 2, 12, 'Semua lembar BA'))

  saran.push(
    perShift(
      'stok',
      'Stok awal setiap shift',
      (t, sh) => stok.has(`${t}#${sh}`),
      (t, sh) => `/stok/${t}/${sh}`,
      'Kontrol stok harian',
    ),
  )
  saran.push(
    perShift(
      'closing',
      'Closing shift',
      (t, sh) => closing.has(`${t}#${sh}`),
      (t, sh) => `/finance/closing/${t}/${sh}`,
      'Transaksi cash opname',
    ),
  )
  saran.push(perHari('qq', 'Kualitas harian (pump test)', (t) => qq.has(t), '/kualitas', 'BA Rekap Tera Nozzle & penjualan bersih'))
  saran.push(perHari('air', 'Water content tangki', (t) => air.has(t), '/kualitas', 'Tinggi air BA SO BBM'))
  saran.push(
    daftar(
      'ket',
      'Keterangan R2/R4 per nozzle',
      s.nozzles.filter((nz) => !data.nozzle[nz.id]?.keterangan?.trim()).map((nz) => `Nozzle ${nz.nama}`),
      s.nozzles.length,
      2,
      'BA Totalisator',
      ' nozzle',
    ),
  )
  const just = [
    ['Justifikasi sales', data.justifikasiSales],
    ['Justifikasi losses', data.justifikasiLosses],
    ['Justifikasi Pertamina Way', data.justifikasiPw],
  ].filter(([, v]) => !v.trim())
  saran.push(
    daftar(
      'justifikasi',
      'Justifikasi sales, losses & Pertamina Way',
      just.map(([k]) => k),
      3,
      10,
      'Lembar Justifikasi',
    ),
  )
  saran.push(daftar('pekerja', 'Update pekerja SPBU', Object.values(data.pekerja).some((v) => isi(v)) ? [] : ['Jumlah pekerja per jabatan'], 1, 11, 'Lembar Update Pekerja'))
  for (const [k, no, nama] of [
    ['lpg', 7, 'LPG'],
    ['enduro', 8, 'Enduro Express'],
    ['petty', 9, 'Petty Cash'],
  ] as const) {
    const fisik = hitungCashSo(data.cash[k] ?? kosongCash(), k).fisik
    saran.push({
      key: `cash-${k}`,
      judul: `Cash opname ${nama}`,
      detail: fisik ? 'Sudah dihitung' : 'Belum diisi (abaikan bila tidak ada)',
      ok: fisik > 0,
      kurang: fisik ? [] : ['Rincian uang'],
      bagian: no,
      untuk: `BA Cash Opname ${nama}`,
    })
  }

  // Rangkuman angka yang masuk BA.
  const penerimaan = penerimaanBulan(s.reports, s.bulan)
  const arus = produk.map((p) =>
    hitungArus(p, {
      tanks: s.tanks,
      data,
      lalu: s.lalu,
      totalizer: s.totalizer,
      nozzles: s.nozzles,
      penerimaan,
      pumpTest,
    }),
  )
  const rangkuman = {
    dari: hari[0],
    sampai: hari.at(-1)!,
    tanggalSo: data.tanggalSo,
    arus,
    penerimaan: {
      jumlah: penerimaan.length,
      order: penerimaan.reduce((n, x) => n + x.order, 0),
      real: penerimaan.reduce((n, x) => n + (x.real ?? 0), 0),
    },
    pumpTest: pumpTest.reduce((n, r) => n + r.liter, 0),
    shift: {
      total: slot.length,
      totalizer: slot.filter((x) => totalizerLengkap(tot.get(`${x.t}#${x.sh}`), s.nozzles)).length,
      stok: slot.filter((x) => stok.has(`${x.t}#${x.sh}`)).length,
      closing: slot.filter((x) => closing.has(`${x.t}#${x.sh}`)).length,
    },
    selesai: now.tanggal > hari.at(-1)!,
  }
  return {
    wajib,
    saran,
    kurangWajib: wajib.filter((x) => !x.ok).length,
    rangkuman,
  }
}
