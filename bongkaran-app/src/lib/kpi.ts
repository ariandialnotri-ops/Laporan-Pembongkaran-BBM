/**
 * Model KPI FLOQ per modul (lihat docs/KPI.md): setiap KPI punya definisi, rumus, target, dan status
 * (ok = memenuhi target, pengingat = mendekati, anomali = jauh dari target). Dihitung per bulan berjalan
 * dari data aplikasi; ditampilkan sebagai highlight di atas setiap dashboard.
 */
import { airLengkap, type AirRecord } from '@/lib/air'
import type { KondisiUnit } from '@/lib/apar'
import { ringkasClosing, type ClosingData } from '@/lib/closing'
import type { Catatan } from '@/lib/catatan'
import { qqD15, stokRecordId, type InsidenRecord, type QqRecord, type StokRecord, type TakarRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { lewatBatas } from '@/lib/harian'
import { ringkasHenti, type HentiItem } from '@/lib/insiden'
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

/** Tanggal 1..hari ini (atau akhir bulan) pada bulan `bulan`. */
function hariBulan(bulan: string, hariIni: string) {
  const n = new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0).getDate()
  return Array.from({ length: n }, (_, i) => `${bulan}-${String(i + 1).padStart(2, '0')}`).filter((t) => t <= hariIni)
}
/** Shift yang sudah dimulai (sampai shift berjalan) atau sudah selesai (`selesai`). */
function shiftBulan(bulan: string, now: Date, selesai: boolean) {
  const kini = currentShift(now)
  const out: { tanggal: string; shift: Shift }[] = []
  for (const t of hariBulan(bulan, kini.tanggal)) for (const s of [1, 2, 3] as Shift[]) {
    const lewat = t < kini.tanggal || s < kini.shift
    if (lewat || (!selesai && t === kini.tanggal && s === kini.shift)) out.push({ tanggal: t, shift: s })
  }
  return out
}
/** Hari yang sudah wajib diperiksa (hari ini dihitung setelah batas 10:00). */
function hariHarian(bulan: string, now: Date) {
  const hariIni = todayIso(now)
  const lewat10 = lewatBatas(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  return hariBulan(bulan, hariIni).filter((t) => t < hariIni || lewat10)
}

export interface DataOperation {
  bulan: string
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
  const { bulan, now } = d
  const out: Kpi[] = []
  const stok = d.daily.filter((x): x is StokRecord => x.kind === 'stok')
  const sh = shiftBulan(bulan, now, false)
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
    rincian: `${stokOk} dari ${sh.length} shift`,
    target: '100%',
    status: statusMin(pStok, 100, 5),
    definisi: 'Persentase shift bulan ini yang stok awal semua produknya sudah diisi di awal shift.',
    rumus: 'shift dengan stok awal lengkap ÷ shift yang sudah dimulai × 100%',
    sumber: 'Operation › Stok Awal Shift',
    ke: '/stok',
  })

  const hari = hariHarian(bulan, now)
  const qq = d.daily.filter((x): x is QqRecord => x.kind === 'qq')
  const qqTepat = hari.filter((t) => qq.some((r) => r.tanggal === t && r.data.selesaiAt && !r.data.terlambat)).length
  const pQq = persen(qqTepat, hari.length)
  out.push({
    id: 'density',
    modul: 'Kualitas',
    label: 'Density harian tepat waktu',
    nilai: fmtPersen(pQq),
    rincian: `${qqTepat} dari ${hari.length} hari`,
    target: '100% (maks. 10:00)',
    status: statusMin(pQq, 100, 10),
    definisi: 'Persentase hari bulan ini yang uji density harian selesai di shift 1 paling lambat pukul 10:00.',
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
      rincian: `${airTepat} dari ${hari.length} hari`,
      target: '100% (maks. 10:00)',
      status: statusMin(pAir, 100, 10),
      definisi: 'Persentase hari bulan ini yang water content semua tangki pendam diperiksa lengkap paling lambat pukul 10:00.',
      rumus: 'hari lengkap tepat waktu ÷ hari wajib periksa × 100%',
      sumber: 'Operation › Kualitas Harian › Water Content Harian',
      ke: '/air',
    })
  }

  const rows = qq.filter((r) => r.tanggal.startsWith(bulan)).flatMap((r) => r.data.kualitas.map((k) => ({ r, k })))
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
    rincian: `${nilai.filter(Boolean).length} dari ${nilai.length} uji`,
    target: '100%',
    status: statusMin(pSesuai, 100, 5),
    definisi: 'Persentase uji density harian yang selisih Density std. 15 °C terhadap acuan pasca penerimaan masih dalam toleransi.',
    rumus: 'uji dalam toleransi ÷ uji dengan acuan × 100%',
    sumber: 'Operation › Kualitas Harian › Density Harian',
    ke: '/laporan/kualitas',
  })

  const selesai = d.reports.filter((r) => r.tanggal.startsWith(bulan) && r.status !== 'draft')
  const diuji = selesai.filter((r) => r.sample2Jam).length
  const pPasca = persen(diuji, selesai.length)
  out.push({
    id: 'pasca',
    modul: 'Kualitas',
    label: 'Uji pasca penerimaan',
    nilai: fmtPersen(pPasca),
    rincian: `${diuji} dari ${selesai.length} penerimaan`,
    target: '100%',
    status: statusMin(pPasca, 100, 10),
    definisi: 'Persentase penerimaan (bongkaran selesai) bulan ini yang sudah diuji density pasca penerimaan.',
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
    rincian: `${normal} dari ${selesai.length} bongkaran`,
    target: '≥ 98%',
    status: statusMin(pNormal, 98, 8),
    definisi: 'Persentase bongkaran bulan ini yang selesai tanpa anomali (susut di luar batas atau density tidak sesuai).',
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
    rincian: `${loss.length} bongkaran terukur`,
    target: '≥ -0,15% dari volume DO',
    status: rataLoss === null ? 'kosong' : rataLoss >= -0.15 ? 'ok' : rataLoss >= -0.3 ? 'pengingat' : 'anomali',
    definisi: 'Rata-rata selisih volume diterima terhadap volume DO pada bongkaran bulan ini (negatif = susut).',
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
    rincian: 'permintaan MS2 → bongkar selesai',
    target: '≤ 24 jam',
    status: sla === null ? 'kosong' : sla <= 1440 ? 'ok' : sla <= 1800 ? 'pengingat' : 'anomali',
    definisi: 'Rata-rata waktu dari permintaan MS2 sampai bongkar selesai untuk bongkaran bulan ini.',
    rumus: 'rata-rata (jam bongkar selesai − jam permintaan MS2)',
    sumber: 'Delivery › Plan Pengiriman & Input Bongkaran',
    ke: '/laporan/lo',
  })

  const takar = d.daily.filter((x): x is TakarRecord => x.kind === 'takar' && (x as TakarRecord).tanggal.startsWith(bulan))
  const takarOk = takar.filter((r) => takarStatus(r.data.hasilMl) !== 'lewat').length
  const pTakar = persen(takarOk, takar.length)
  out.push({
    id: 'takar',
    modul: 'Operation',
    label: 'Uji takaran sesuai toleransi',
    nilai: fmtPersen(pTakar),
    rincian: `${takarOk} dari ${takar.length} uji`,
    target: '100%',
    status: statusMin(pTakar, 100, 5),
    definisi: 'Persentase uji takaran bejana 20 L bulan ini yang hasilnya dalam toleransi.',
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
      const k = kepatuhanBulan(forms, d.ops, bulan, todayIso(now))
      out.push({
        id,
        modul: 'Operation',
        label,
        nilai: `${k.persen}%`,
        rincian: `${k.hariLengkap} dari ${k.hariDinilai} hari lengkap`,
        target: '≥ 95%',
        status: k.hariDinilai ? statusMin(k.persen, 95, 15) : 'kosong',
        definisi: `Persentase form ${id === 'hk' ? 'checklist housekeeping' : 'kartu perawatan'} harian yang terisi lengkap bulan ini.`,
        rumus: 'form harian lengkap ÷ (jumlah form × hari dinilai) × 100%',
        sumber: id === 'hk' ? 'Operation › Housekeeping' : 'Operation › Perawatan',
        ke,
      })
    }
  }
  return out
}

export interface DataFinance {
  bulan: string
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
  const sh = shiftBulan(d.bulan, d.now, true)
  if (d.closing) {
    const ada = sh.filter((k) => d.closing!.some((r) => r.tanggal === k.tanggal && r.shift === k.shift)).length
    const p = persen(ada, sh.length)
    out.push({
      id: 'closing',
      modul: 'Finance',
      label: 'Closing shift tercatat',
      nilai: fmtPersen(p),
      rincian: `${ada} dari ${sh.length} shift`,
      target: '100%',
      status: statusMin(p, 100, 10),
      definisi: 'Persentase shift yang sudah selesai bulan ini dan sudah dicatat closing shift (hitung buta).',
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
      rincian: `${lengkap} dari ${sh.length} shift`,
      target: '100%',
      status: statusMin(p, 100, 10),
      definisi: 'Persentase shift selesai yang totalizer awal & akhir semua nozzle sudah dicatat (dasar penjualan BBM).',
      rumus: 'shift totalizer lengkap ÷ shift selesai × 100%',
      sumber: 'Operation › Totalizer',
      ke: '/laporan/totalizer',
    })
  }
  if (d.petty) {
    const real = d.petty.reduce((a, r) => a + (r.data.realisasi?.tanggal.startsWith(d.bulan) ? r.data.realisasi.nominal : 0), 0)
    const p = d.plafon ? persen(real, d.plafon) : null
    out.push({
      id: 'plafon',
      modul: 'Finance',
      label: 'Realisasi terhadap plafon',
      nilai: fmtPersen(p),
      rincian: d.plafon ? `dari plafon bulan ini` : 'plafon belum diatur',
      target: '≤ 100%',
      status: p === null ? 'kosong' : p <= 90 ? 'ok' : p <= 100 ? 'pengingat' : 'anomali',
      definisi: 'Realisasi petty cash bulan ini dibanding plafon yang diatur ABH.',
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
  bulan: string
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
  const ins = d.insiden.filter((r) => r.data.jenis !== 'henti' && r.tanggal.startsWith(d.bulan))
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
    rincian: `${ins.length} laporan bulan ini`,
    target: '≥ 90%',
    status: ins.length ? statusMin(pi, 90, 20) : 'ok',
    definisi: 'Persentase laporan insiden, near miss, dan kerusakan bulan ini yang ditutup paling lambat 7 hari.',
    rumus: 'ditutup ≤ 7 hari ÷ (ditutup + terbuka > 7 hari) × 100%',
    sumber: 'HSSE › Lapor Insiden',
    ke: '/laporan/insiden',
  })
  const r = ringkasHenti(d.henti, d.bulan)
  out.push({
    id: 'henti',
    modul: 'HSSE',
    label: 'Lama stop penyaluran',
    nilai: r.totalMenit ? (r.totalMenit >= 60 ? `${Math.floor(r.totalMenit / 60)} j ${r.totalMenit % 60} m` : `${r.totalMenit} m`) : '0',
    rincian: `${r.kejadian} kejadian${r.aktif.length ? `, ${r.aktif.length} masih berhenti` : ''}`,
    target: '0 jam, tidak ada yang masih berhenti',
    status: r.aktif.length ? 'anomali' : r.totalMenit > 240 ? 'pengingat' : 'ok',
    definisi: 'Total lama penyaluran produk dihentikan bulan ini (downtime).',
    rumus: 'Σ (jam penyaluran kembali − jam mulai berhenti)',
    sumber: 'Operation › Stop Penyaluran',
    ke: '/stop-penyaluran',
  })
  return out
}

/** Awal rentang data yang perlu dimuat untuk KPI bulan `bulan` (guard tour 7 hari). */
export const awalKpi = (bulan: string) => todayIso(addDays(new Date(`${bulan}-01T00:00:00`), -7))
