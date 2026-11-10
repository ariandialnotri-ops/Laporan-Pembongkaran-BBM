/**
 * Model KPI FLOQ per modul (lihat docs/KPI.md): setiap KPI punya definisi, rumus, target, dan status
 * (ok = memenuhi target, pengingat = mendekati, anomali = jauh dari target). Dihitung untuk periode filter
 * dashboard (bawaan: bulan berjalan) dari data aplikasi; ditampilkan sebagai highlight di atas setiap dashboard,
 * dengan perubahan terhadap periode sebelumnya yang sama panjang.
 */
import { airLengkap, type AirRecord } from '@/lib/air'
import type { KondisiUnit } from '@/lib/apar'
import { ringkasClosing, type ClosingData } from '@/lib/closing'
import type { Catatan } from '@/lib/catatan'
import { qqD15, stokRecordId, type InsidenRecord, type QqRecord, type StokRecord, type TakarRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { lewatBatas } from '@/lib/harian'
import { menitHenti, type HentiItem } from '@/lib/insiden'
import { kepatuhanBulan, type OpsRecord } from '@/lib/ops'
import { jenisPetty, type PettyRecord } from '@/lib/petty'
import { acuanD15 } from '@/lib/ringkasan'
import { currentShift, type Shift } from '@/lib/shift'
import { rataRata, slaOf } from '@/lib/sla'
import type { Nozzle, Plan, ReportSummary, Rules } from '@/lib/sop'
import { takarStatus } from '@/lib/takar'
import type { Tank } from '@/lib/tank'
import { totalizerLengkap, type TotalizerData } from '@/lib/totalizer'

export type ModulKpi = 'Operation' | 'Delivery' | 'Kualitas' | 'HSSE' | 'Finance'
export type StatusKpi = 'ok' | 'pengingat' | 'anomali' | 'kosong'

export interface Kpi {
  id: string
  modul: ModulKpi
  label: string
  /** Nilai tampilan, mis. "96%", "-0,08%", "5 jam". */
  nilai: string
  /** Nilai angka untuk perubahan antar periode (persen, menit, ...); null = tidak dibandingkan. */
  angka: number | null
  /** Arah perbaikan: naik (persentase kepatuhan) atau turun (waktu kirim, downtime). */
  arah: 'naik' | 'turun'
  /** Satuan perubahan, mis. "%" (poin persen) atau " mnt". */
  satuanDelta: string
  /** Rincian, mis. "24 dari 25 shift". */
  rincian: string
  target: string
  status: StatusKpi
  definisi: string
  rumus: string
  sumber: string
  /** Halaman untuk menindaklanjuti. */
  ke: string
}

const persen = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
const fmtPersen = (p: number | null) => (p === null ? '-' : `${String(p).replace('.', ',')}%`)
/** Status persentase terhadap target minimum: ok ≥ target, pengingat ≥ target − toleransi. */
const statusMin = (p: number | null, target: number, toleransi = 10): StatusKpi => (p === null ? 'kosong' : p >= target ? 'ok' : p >= target - toleransi ? 'pengingat' : 'anomali')

/** Periode KPI: tanggal awal & akhir (YYYY-MM-DD), inklusif. */
export interface Periode {
  dari: string
  sampai: string
}
const dalam = (t: string, p: Periode) => t >= p.dari && t <= p.sampai
/** Tanggal dari..sampai yang tidak melewati hari ini. */
function hariRentang(p: Periode, hariIni: string) {
  const out: string[] = []
  for (let t = p.dari; t <= p.sampai && t <= hariIni; t = todayIso(addDays(new Date(`${t}T00:00:00`), 1))) out.push(t)
  return out
}
/** Periode sebelumnya dengan panjang hari yang sama (untuk perubahan KPI). */
export function periodeSebelum(p: Periode): Periode {
  const n = Math.round((Date.parse(`${p.sampai}T00:00:00`) - Date.parse(`${p.dari}T00:00:00`)) / 86400_000) + 1
  return { dari: todayIso(addDays(new Date(`${p.dari}T00:00:00`), -n)), sampai: todayIso(addDays(new Date(`${p.dari}T00:00:00`), -1)) }
}
/** Shift yang sudah dimulai (sampai shift berjalan) atau sudah selesai (`selesai`). */
function shiftRentang(p: Periode, now: Date, selesai: boolean) {
  const kini = currentShift(now)
  const out: { tanggal: string; shift: Shift }[] = []
  for (const t of hariRentang(p, kini.tanggal)) for (const s of [1, 2, 3] as Shift[]) {
    const lewat = t < kini.tanggal || s < kini.shift
    if (lewat || (!selesai && t === kini.tanggal && s === kini.shift)) out.push({ tanggal: t, shift: s })
  }
  return out
}
/** Hari yang sudah wajib diperiksa (hari ini dihitung setelah batas 10:00). */
function hariHarian(p: Periode, now: Date) {
  const hariIni = todayIso(now)
  const lewat10 = lewatBatas(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  return hariRentang(p, hariIni).filter((t) => t < hariIni || lewat10)
}

export interface DataOperation {
  periode: Periode
  now: Date
  daily: { kind: string }[]
  reports: ReportSummary[]
  plans: Plan[]
  rules: Rules
  tanks: Tank[]
  air: AirRecord[] | null
  ops: OpsRecord[] | null
  formRawat: string[]
  formHk: string[]
}

/** KPI Operation, Delivery & Kualitas (Dashboard Operation). */
export function kpiOperation(d: DataOperation): Kpi[] {
  const { periode, now } = d
  const out: Kpi[] = []
  const stok = d.daily.filter((x): x is StokRecord => x.kind === 'stok')
  const sh = shiftRentang(periode, now, false)
  const stokOk = sh.filter((k) => {
    const r = stok.find((x) => x.id === stokRecordId(k.tanggal, k.shift))
    return !!r && d.tanks.every((t) => (r.data.items[t.produk]?.volume ?? '').trim() !== '')
  }).length
  const pStok = d.tanks.length ? persen(stokOk, sh.length) : null
  out.push({
    id: 'stok',
    modul: 'Operation',
    label: 'Stok awal shift terisi',
    nilai: fmtPersen(pStok),
    angka: pStok,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${stokOk} dari ${sh.length} shift`,
    target: '100%',
    status: statusMin(pStok, 100, 5),
    definisi: 'Persentase shift pada periode ini yang stok awal semua produknya sudah diisi di awal shift.',
    rumus: 'shift dengan stok awal lengkap ÷ shift yang sudah dimulai × 100%',
    sumber: 'Operation › Stok Awal Shift',
    ke: '/stok',
  })

  const hari = hariHarian(periode, now)
  const qq = d.daily.filter((x): x is QqRecord => x.kind === 'qq')
  const qqTepat = hari.filter((t) => qq.some((r) => r.tanggal === t && r.data.selesaiAt && !r.data.terlambat)).length
  const pQq = persen(qqTepat, hari.length)
  out.push({
    id: 'density',
    modul: 'Kualitas',
    label: 'Density harian tepat waktu',
    nilai: fmtPersen(pQq),
    angka: pQq,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${qqTepat} dari ${hari.length} hari`,
    target: '100% (maks. 10:00)',
    status: statusMin(pQq, 100, 10),
    definisi: 'Persentase hari pada periode ini yang uji density harian selesai di shift 1 paling lambat pukul 10:00.',
    rumus: 'hari selesai tepat waktu ÷ hari wajib uji × 100%',
    sumber: 'Operation › Kualitas Harian › Density Harian',
    ke: '/kualitas/density',
  })

  if (d.air && d.tanks.length) {
    const airTepat = hari.filter((t) => d.air!.some((r) => r.tanggal === t && airLengkap(r, d.tanks) && !r.data.terlambat)).length
    const pAir = persen(airTepat, hari.length)
    out.push({
      id: 'air',
      modul: 'Kualitas',
      label: 'Water content tepat waktu',
      nilai: fmtPersen(pAir),
      angka: pAir,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${airTepat} dari ${hari.length} hari`,
      target: '100% (maks. 10:00)',
      status: statusMin(pAir, 100, 10),
      definisi: 'Persentase hari pada periode ini yang water content semua tangki pendam diperiksa lengkap paling lambat pukul 10:00.',
      rumus: 'hari lengkap tepat waktu ÷ hari wajib periksa × 100%',
      sumber: 'Operation › Kualitas Harian › Water Content Harian',
      ke: '/air',
    })
  }

  const rows = qq.filter((r) => dalam(r.tanggal, periode)).flatMap((r) => r.data.kualitas.map((k) => ({ r, k })))
  const nilai = rows
    .map(({ r, k }) => {
      const d15 = qqD15(k).d15
      const ref = acuanD15(d.reports, k.produk, r.tanggal)
      return d15 && ref ? Math.abs(d15.value - ref.d15) <= d.rules.densityTolerance + 1e-9 : null
    })
    .filter((x): x is boolean => x !== null)
  const pSesuai = persen(nilai.filter(Boolean).length, nilai.length)
  out.push({
    id: 'density-sesuai',
    modul: 'Kualitas',
    label: 'Uji density sesuai toleransi',
    nilai: fmtPersen(pSesuai),
    angka: pSesuai,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${nilai.filter(Boolean).length} dari ${nilai.length} uji`,
    target: '100%',
    status: statusMin(pSesuai, 100, 5),
    definisi: 'Persentase uji density harian yang selisih Density std. 15 °C terhadap acuan pasca penerimaan masih dalam toleransi.',
    rumus: 'uji dalam toleransi ÷ uji dengan acuan × 100%',
    sumber: 'Operation › Kualitas Harian › Density Harian',
    ke: '/laporan/kualitas',
  })

  const selesai = d.reports.filter((r) => dalam(r.tanggal, periode) && r.status !== 'draft')
  const diuji = selesai.filter((r) => r.sample2Jam).length
  const pPasca = persen(diuji, selesai.length)
  out.push({
    id: 'pasca',
    modul: 'Kualitas',
    label: 'Uji pasca penerimaan',
    nilai: fmtPersen(pPasca),
    angka: pPasca,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${diuji} dari ${selesai.length} penerimaan`,
    target: '100%',
    status: statusMin(pPasca, 100, 10),
    definisi: 'Persentase penerimaan (bongkaran selesai) pada periode ini yang sudah diuji density pasca penerimaan.',
    rumus: 'penerimaan diuji ÷ penerimaan selesai × 100%',
    sumber: 'Operation › Kualitas Pasca Penerimaan',
    ke: '/sample',
  })

  const normal = selesai.filter((r) => r.status === 'selesai').length
  const pNormal = persen(normal, selesai.length)
  out.push({
    id: 'bongkar-normal',
    modul: 'Delivery',
    label: 'Bongkaran tanpa anomali',
    nilai: fmtPersen(pNormal),
    angka: pNormal,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${normal} dari ${selesai.length} bongkaran`,
    target: '≥ 98%',
    status: statusMin(pNormal, 98, 8),
    definisi: 'Persentase bongkaran pada periode ini yang selesai tanpa anomali (susut di luar batas atau density tidak sesuai).',
    rumus: 'bongkaran status selesai ÷ bongkaran selesai + anomali × 100%',
    sumber: 'Operation › Input Bongkaran',
    ke: '/laporan/bongkaran',
  })

  const loss = selesai.filter((r) => r.gainLoss !== null && r.volumeDO).map((r) => (r.gainLoss! / r.volumeDO!) * 100)
  const rataLoss = loss.length ? Math.round((loss.reduce((a, b) => a + b, 0) / loss.length) * 100) / 100 : null
  out.push({
    id: 'losses',
    modul: 'Delivery',
    label: 'Rata-rata gain/loss bongkar',
    nilai: rataLoss === null ? '-' : `${rataLoss > 0 ? '+' : ''}${String(rataLoss).replace('.', ',')}%`,
    angka: rataLoss,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${loss.length} bongkaran terukur`,
    target: '≥ -0,15% dari volume DO',
    status: rataLoss === null ? 'kosong' : rataLoss >= -0.15 ? 'ok' : rataLoss >= -0.3 ? 'pengingat' : 'anomali',
    definisi: 'Rata-rata selisih volume diterima terhadap volume DO pada bongkaran pada periode ini (negatif = susut).',
    rumus: 'rata-rata (gain/loss ÷ volume DO × 100%)',
    sumber: 'Operation › Input Bongkaran',
    ke: '/laporan/bongkaran',
  })

  const sla = rataRata(selesai.map((r) => slaOf(r, d.plans).permintaan))
  out.push({
    id: 'sla',
    modul: 'Delivery',
    label: 'Rata-rata waktu kirim',
    nilai: sla === null ? '-' : sla >= 60 ? `${Math.floor(sla / 60)} j ${sla % 60} m` : `${sla} m`,
    angka: sla,
    arah: 'turun',
    satuanDelta: ' mnt',
    rincian: 'permintaan MS2 → bongkar selesai',
    target: '≤ 24 jam',
    status: sla === null ? 'kosong' : sla <= 1440 ? 'ok' : sla <= 1800 ? 'pengingat' : 'anomali',
    definisi: 'Rata-rata waktu dari permintaan MS2 sampai bongkar selesai untuk bongkaran pada periode ini.',
    rumus: 'rata-rata (jam bongkar selesai − jam permintaan MS2)',
    sumber: 'Delivery › Plan Pengiriman & Input Bongkaran',
    ke: '/plan',
  })

  const takar = d.daily.filter((x): x is TakarRecord => x.kind === 'takar' && dalam((x as TakarRecord).tanggal, periode))
  const takarOk = takar.filter((r) => takarStatus(r.data.hasilMl) !== 'lewat').length
  const pTakar = persen(takarOk, takar.length)
  out.push({
    id: 'takar',
    modul: 'Operation',
    label: 'Uji takaran sesuai toleransi',
    nilai: fmtPersen(pTakar),
    angka: pTakar,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${takarOk} dari ${takar.length} uji`,
    target: '100%',
    status: statusMin(pTakar, 100, 5),
    definisi: 'Persentase uji takaran bejana 20 L pada periode ini yang hasilnya dalam toleransi.',
    rumus: 'uji dalam toleransi ÷ total uji × 100%',
    sumber: 'Operation › Uji Takaran',
    ke: '/laporan/takaran',
  })

  if (d.ops) {
    for (const [id, forms, label, ke] of [
      ['rawat', d.formRawat, 'Kepatuhan perawatan', '/ops?grup=operasional&kategori=rawat'],
      ['hk', d.formHk, 'Kepatuhan housekeeping', '/ops/kalender?kategori=hk'],
    ] as const) {
      if (!forms.length) continue
      const k = kepatuhanRentang(forms, d.ops, periode, todayIso(now))
      out.push({
        id,
        modul: 'Operation',
        label,
        nilai: `${k.persen}%`,
        angka: k.hariDinilai ? k.persen : null,
        arah: 'naik',
        satuanDelta: '%',
        rincian: `${k.hariLengkap} dari ${k.hariDinilai} hari lengkap`,
        target: '≥ 95%',
        status: k.hariDinilai ? statusMin(k.persen, 95, 15) : 'kosong',
        definisi: `Persentase form ${id === 'hk' ? 'checklist housekeeping' : 'kartu perawatan'} harian yang terisi lengkap pada periode ini.`,
        rumus: 'form harian lengkap ÷ (jumlah form × hari dinilai) × 100%',
        sumber: id === 'hk' ? 'Operation › Housekeeping' : 'Operation › Perawatan',
        ke,
      })
    }
  }
  return out
}

export interface DataFinance {
  periode: Periode
  now: Date
  closing: Catatan<ClosingData>[] | null
  totalizer: Catatan<TotalizerData>[] | null
  nozzles: Nozzle[]
  petty: PettyRecord[] | null
  plafon: number
}

/** KPI Sales / Finance. */
export function kpiFinance(d: DataFinance): Kpi[] {
  const out: Kpi[] = []
  const sh = shiftRentang(d.periode, d.now, true)
  if (d.closing) {
    const ada = sh.filter((k) => d.closing!.some((r) => r.tanggal === k.tanggal && r.shift === k.shift)).length
    const p = persen(ada, sh.length)
    out.push({
      id: 'closing',
      modul: 'Finance',
      label: 'Closing shift tercatat',
      nilai: fmtPersen(p),
      angka: p,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${ada} dari ${sh.length} shift`,
      target: '100%',
      status: statusMin(p, 100, 10),
      definisi: 'Persentase shift yang sudah selesai pada periode ini dan sudah dicatat closing shift (hitung buta).',
      rumus: 'shift dengan closing ÷ shift selesai × 100%',
      sumber: 'Finance › Closing Shift',
      ke: '/finance/closing',
    })
    const hit = d.closing.map((r) => ringkasClosing(r.data).selisih).filter((x): x is number => x !== null)
    const pas = hit.filter((x) => x >= 0).length
    const pp = persen(pas, hit.length)
    out.push({
      id: 'selisih',
      modul: 'Finance',
      label: 'Closing tanpa selisih kurang',
      nilai: fmtPersen(pp),
      angka: pp,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${pas} dari ${hit.length} closing`,
      target: '100%',
      status: statusMin(pp, 100, 5),
      definisi: 'Persentase closing shift yang uang fisiknya tidak kurang dari setoran seharusnya.',
      rumus: 'closing dengan selisih ≥ 0 ÷ closing yang dapat dihitung × 100%',
      sumber: 'Finance › Closing Shift',
      ke: '/finance/closing',
    })
  }
  if (d.totalizer && d.nozzles.length) {
    const lengkap = sh.filter((k) => totalizerLengkap(d.totalizer!.find((r) => r.tanggal === k.tanggal && r.shift === k.shift), d.nozzles)).length
    const p = persen(lengkap, sh.length)
    out.push({
      id: 'totalizer',
      modul: 'Finance',
      label: 'Totalizer lengkap per shift',
      nilai: fmtPersen(p),
      angka: p,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${lengkap} dari ${sh.length} shift`,
      target: '100%',
      status: statusMin(p, 100, 10),
      definisi: 'Persentase shift selesai yang totalisator digital akhir semua nozzle sudah dicatat kepala shift (awal = akhir shift sebelumnya; dasar penjualan BBM).',
      rumus: 'shift totalizer lengkap ÷ shift selesai × 100%',
      sumber: 'Operation › Totalizer',
      ke: '/laporan/totalizer',
    })
  }
  if (d.petty) {
    const real = d.petty.reduce((a, r) => a + (r.data.realisasi && dalam(r.data.realisasi.tanggal, d.periode) ? r.data.realisasi.nominal : 0), 0)
    // Plafon bulanan dihitung proporsional terhadap panjang periode.
    const hariP = hariRentang(d.periode, '9999-12-31').length
    const plafon = d.plafon * Math.max(1, Math.round(hariP / 30.4))
    const p = plafon ? persen(real, plafon) : null
    out.push({
      id: 'plafon',
      modul: 'Finance',
      label: 'Realisasi terhadap plafon',
      nilai: fmtPersen(p),
      angka: p,
      arah: 'turun',
      satuanDelta: '%',
      rincian: d.plafon ? `dari plafon (proporsional periode)` : 'plafon belum diatur',
      target: '≤ 100%',
      status: p === null ? 'kosong' : p <= 90 ? 'ok' : p <= 100 ? 'pengingat' : 'anomali',
      definisi: 'Realisasi petty cash pada periode ini dibanding plafon yang diatur ABH.',
      rumus: 'total realisasi ÷ plafon × 100%',
      sumber: 'Finance › Petty Cash › Realisasi',
      ke: '/finance/petty/realisasi',
    })
    const batas = 3 * 86400_000
    const disetujui = d.petty.filter((r) => r.status === 'Disetujui' && jenisPetty(r) === 'pengadaan' && r.data.keputusan)
    const nilai = disetujui
      .map((r) => {
        const mulai = Date.parse(r.data.keputusan!.at)
        if (r.data.settlement) return Date.parse(r.data.settlement.at) - mulai <= batas
        return d.now.getTime() - mulai > batas ? false : null
      })
      .filter((x): x is boolean => x !== null)
    const ps = persen(nilai.filter(Boolean).length, nilai.length)
    out.push({
      id: 'settlement',
      modul: 'Finance',
      label: 'Settlement ≤ 3 hari',
      nilai: fmtPersen(ps),
      angka: ps,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${nilai.filter(Boolean).length} dari ${nilai.length} pengajuan`,
      target: '≥ 90%',
      status: statusMin(ps, 90, 15),
      definisi: 'Persentase pengajuan pengadaan yang disetujui ABH lalu dibuat settlement (struk & foto barang) paling lambat 3 hari.',
      rumus: 'settlement ≤ 3 hari ÷ (settlement + belum settlement > 3 hari) × 100%',
      sumber: 'Finance › Pengajuan Anggaran',
      ke: '/finance/petty/pengajuan',
    })
  }
  return out
}

export interface DataHsse {
  periode: Periode
  now: Date
  apar: KondisiUnit[]
  insiden: InsidenRecord[]
  henti: HentiItem[]
  /** Persentase kepatuhan guard tour 7 hari (null bila tidak terbaca peran ini). */
  guardTour: { ok: number; total: number } | null
}

/** KPI HSSE & Guard Patrol. */
export function kpiHsse(d: DataHsse): Kpi[] {
  const out: Kpi[] = []
  if (d.apar.length) {
    const cek = d.apar.filter((k) => k.bulanIni).length
    const p = persen(cek, d.apar.length)
    out.push({
      id: 'apar',
      modul: 'HSSE',
      label: 'Inspeksi APAR bulan ini',
      nilai: fmtPersen(p),
      angka: null,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${cek} dari ${d.apar.length} unit`,
      target: '100%',
      status: statusMin(p, 100, 20),
      definisi: 'Persentase unit APAR & APAB yang sudah diinspeksi bulan ini.',
      rumus: 'unit diinspeksi bulan ini ÷ total unit × 100%',
      sumber: 'HSSE › APAR & APAB',
      ke: '/apar',
    })
    const siap = d.apar.filter((k) => k.status !== 'temuan' && k.isiUlang !== 'lewat' && k.instansi !== 'lewat').length
    const ps = persen(siap, d.apar.length)
    out.push({
      id: 'apar-siap',
      modul: 'HSSE',
      label: 'APAR siap pakai',
      nilai: fmtPersen(ps),
      angka: null,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${siap} dari ${d.apar.length} unit`,
      target: '100%',
      status: statusMin(ps, 100, 10),
      definisi: 'Persentase unit tanpa temuan dan masa isi ulang / pemeriksaan instansi belum lewat.',
      rumus: 'unit siap pakai ÷ total unit × 100%',
      sumber: 'HSSE › APAR & APAB',
      ke: '/apar',
    })
  }
  if (d.guardTour) {
    const p = persen(d.guardTour.ok, d.guardTour.total)
    out.push({
      id: 'guard',
      modul: 'HSSE',
      label: 'Kepatuhan guard tour 7 hari',
      nilai: fmtPersen(p),
      angka: null,
      arah: 'naik',
      satuanDelta: '%',
      rincian: `${d.guardTour.ok} dari ${d.guardTour.total} slot`,
      target: '≥ 90%',
      status: statusMin(p, 90, 15),
      definisi: 'Persentase slot 2 jam (7 hari terakhir) dengan sampling penyaluran JBT & JBKP lengkap.',
      rumus: 'slot lengkap ÷ slot yang sudah lewat × 100%',
      sumber: 'HSSE › Sampling Penyaluran Subsidi',
      ke: '/gts',
    })
  }
  const batas = 7 * 86400_000
  const ins = d.insiden.filter((r) => r.data.jenis !== 'henti' && dalam(r.tanggal, d.periode))
  const nilai = ins
    .map((r) => {
      const tutup = r.data.status === 'selesai' ? [...r.data.riwayat].reverse().find((x) => x.status === 'selesai') : undefined
      if (tutup) return Date.parse(tutup.at) - r.createdAt <= batas
      return d.now.getTime() - r.createdAt > batas ? false : null
    })
    .filter((x): x is boolean => x !== null)
  const pi = persen(nilai.filter(Boolean).length, nilai.length)
  out.push({
    id: 'insiden',
    modul: 'HSSE',
    label: 'Insiden ditutup ≤ 7 hari',
    nilai: ins.length ? fmtPersen(pi) : 'Nihil',
    angka: ins.length ? pi : null,
    arah: 'naik',
    satuanDelta: '%',
    rincian: `${ins.length} laporan pada periode ini`,
    target: '≥ 90%',
    status: ins.length ? statusMin(pi, 90, 20) : 'ok',
    definisi: 'Persentase laporan kejadian (insiden, near miss, temuan, kerusakan) pada periode ini yang ditutup paling lambat 7 hari.',
    rumus: 'ditutup ≤ 7 hari ÷ (ditutup + terbuka > 7 hari) × 100%',
    sumber: 'HSSE › Lapor Kejadian',
    ke: '/laporan/insiden',
  })
  const hentiP = d.henti.filter((x) => dalam(x.h.mulai.slice(0, 10), d.periode))
  const r = { kejadian: hentiP.length, aktif: d.henti.filter((x) => !x.h.selesai), totalMenit: hentiP.reduce((n, x) => n + menitHenti(x.h), 0) }
  out.push({
    id: 'henti',
    modul: 'HSSE',
    label: 'Lama stop penyaluran',
    nilai: r.totalMenit ? (r.totalMenit >= 60 ? `${Math.floor(r.totalMenit / 60)} j ${r.totalMenit % 60} m` : `${r.totalMenit} m`) : '0',
    angka: r.totalMenit,
    arah: 'turun',
    satuanDelta: ' mnt',
    rincian: `${r.kejadian} kejadian${r.aktif.length ? `, ${r.aktif.length} masih berhenti` : ''}`,
    target: '0 jam, tidak ada yang masih berhenti',
    status: r.aktif.length ? 'anomali' : r.totalMenit > 240 ? 'pengingat' : 'ok',
    definisi: 'Total lama penyaluran produk dihentikan pada periode ini (downtime).',
    rumus: 'Σ (jam penyaluran kembali − jam mulai berhenti)',
    sumber: 'Operation › Stop Penyaluran',
    ke: '/stop-penyaluran',
  })
  return out
}

/** Kepatuhan form harian (perawatan / housekeeping) pada periode: gabungan per bulan yang tercakup. */
function kepatuhanRentang(forms: string[], recs: OpsRecord[], p: Periode, hariIni: string) {
  const bulan = [...new Set(hariRentang(p, hariIni).map((t) => t.slice(0, 7)))]
  const hari = bulan.flatMap((b) => kepatuhanBulan(forms, recs, b, hariIni).hari).filter((h) => dalam(h.tanggal, p) && !h.nanti && h.total)
  const total = hari.reduce((n, h) => n + h.total, 0)
  const lengkap = hari.reduce((n, h) => n + h.lengkap, 0)
  return { persen: total ? Math.round((lengkap / total) * 100) : 0, hariDinilai: hari.length, hariLengkap: hari.filter((h) => h.lengkap >= h.total).length }
}
