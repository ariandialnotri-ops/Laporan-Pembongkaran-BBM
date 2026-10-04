/**
 * Alur SOP pembongkaran BBM: tipe data, definisi tahapan, validasi tiap
 * tahap, dan perhitungan kuantitas/kualitas untuk Berita Acara.
 */
import { density15, normalizeDensity, type Density15 } from '@/lib/density'
import { minutesBetween, nowHm, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { shiftKey, type Shift } from '@/lib/shift'
import { getTank, volumeFromLevel, type Tank, type VolumeResult } from '@/lib/tank'

export interface Photo {
  id: string
  name: string
  at: string
  /** Lokasi di Supabase Storage (mode server). */
  path?: string
  /** Isi foto; selalu ada di mode lokal, di mode server hanya untuk foto yang baru diambil. */
  dataUrl?: string
}
export type Photos = Record<string, Photo[]>

export type ReportStatus = 'draft' | 'selesai' | 'anomali'

export interface Compartment {
  id: string
  no: string
  tinggiTera: string
  /** Kapasitas kompartemen (L) dari buku tera, dipakai menghitung selisih liter. */
  kapasitas: string
  /** Laporan lama: liter per mm. */
  kepekaan: string
  dipAktual: string
  noSegel: string
}

export interface DensityTest {
  id: string
  kompartemenId: string
  densityObs: string
  suhu: string
}

export interface AtgReading {
  tinggi: string
  volume: string
  suhu: string
}

export interface TeraApproval {
  nama: string
  jabatan: string
  alasan: string
  waktu: string
  snapshot: { no: string; selisihMm: number | null }[]
}

/** Totalisator satu nozzle selama pembongkaran (penjualan selama bongkar). */
export interface Totalisator {
  nozzleId: string
  nozzle: string
  awal: string
  akhir: string
}

export type SignerKey = 'penerima' | 'security' | 'supir' | 'pengawas' | 'abh'
export interface Signature {
  nama: string
  /** PNG dataURL tanda tangan; kosong bila belum ditandatangani. */
  img: string
  at: string
}

export const SIGNERS: { key: SignerKey; label: string; wajib: boolean }[] = [
  { key: 'penerima', label: 'Penerima', wajib: true },
  { key: 'security', label: 'Security', wajib: true },
  { key: 'supir', label: 'Supir Tangki', wajib: true },
  { key: 'pengawas', label: 'Pengawas', wajib: false },
  { key: 'abh', label: 'Area Business Head', wajib: false },
]

export interface ReportData {
  planId: string
  noSO: string
  loIds: string[]
  noLOs: string[]
  tanggalDatang: string
  jamDatang: string
  nopol: string
  namaDriver: string
  /** Laporan lama memakai Sold To; laporan baru Ship To. */
  soldTo: string
  shipTo: string
  produk: string
  /** Laporan lama: jumlah DO x liter per DO. */
  jumlahDO: string
  /** Volume DO/LO yang diterima (liter). */
  volumeDO: string
  /** Nomor segel dari data LO di Plan Kirim, untuk dicocokkan di tahap segel. */
  segelLO: string[]
  perusahaanPengangkut: string
  densityObsDepot: string
  suhuObsDepot: string
  density15Depot: string
  tanggalKeluar: string
  jamKeluar: string
  compartments: Compartment[]
  tankId: string
  atgBefore: AtgReading
  safetyApar: boolean
  safetyArde: boolean
  safetyAtribut: boolean
  segelSesuai: boolean
  dipBeforeMm: string
  airNihil: boolean | null
  teraApproval: TeraApproval | null
  sampelSesuai: boolean
  densityTests: DensityTest[]
  fillportSesuai: boolean
  jamSelesaiBongkar: string
  jamBacaAtg: string
  atgAfter: AtgReading
  penjualanSelamaBongkar: string
  totalisator: Totalisator[]
  dipAfterMm: string
  ttd: Partial<Record<SignerKey, Signature>>
  /** Uji sampel BBM dari tangki pendam minimal 2 jam setelah bongkar selesai. */
  sample2Jam?: Sample2Jam | null
  noBA: string
  namaPetugas: string
  namaPengawas: string
  catatan: string
}

export interface Report {
  id: string
  createdAt: number
  updatedAt: number
  status: ReportStatus
  finishedAt: number | null
  createdBy: string | null
  photos: Photos
  data: ReportData
}

export type LoStatus = 'os' | 'planned' | 'delivery' | 'alih' | 'deleted' | 'delivered' | 'closed'

export interface PlanLo {
  id: string
  /** Kosong selama permintaan masih diproses depot. */
  noLO: string
  produk: string
  /** Volume liter. */
  volume: number
  status: LoStatus
  /** Nomor segel per produk sesuai dokumen LO. */
  segel: string[]
  /** Shift permintaan untuk produk ini (boleh beda antar produk dalam satu permintaan). */
  shift?: '' | '1' | '2'
  /** Supply point LO ini bila berbeda dari plan (setelah alih supply). */
  supplyPoint?: string
  noLOLama?: string
  supplyPointLama?: string
  /** Plan lama: jumlah DO. */
  jumlahDO?: number
}

export interface Plan {
  id: string
  createdAt: number
  /** Tanggal kirim. */
  tanggal: string
  ms2Tanggal: string
  ms2Jam: string
  /** Shift permintaan minyak lewat MS2 (hanya shift 1 & 2). */
  ms2Shift: '' | '1' | '2'
  poSap: string
  shipTo: string
  supplyPoint: string
  /** Kosong sampai depot menerbitkan SO. */
  noSO: string
  /** Plan lama: satu produk per SO. */
  produk: string
  /** Plan lama: Sold To. */
  soldTo: string
  los: PlanLo[]
}

export const SUPPLY_POINTS = ['IT Surabaya', 'FT Madiun', 'FT Boyolali']

/** Ringkasan per laporan untuk daftar, beranda, dan penanda LO terpakai. */
export interface Sample2Jam {
  tanggal: string
  jam: string
  densityObs: string
  suhu: string
  petugas: string
  catatan: string
  savedAt: string
}

/** Jeda minimal antara bongkar selesai dan pengambilan sampel tangki pendam. */
export const SAMPLE_JEDA_MENIT = 120

export interface Sample2JamResult {
  d15: Density15 | null
  /** Selisih terhadap D15 dokumen depot. */
  selisih: number | null
  ok: boolean | null
  /** Menit sejak bongkar selesai. */
  jedaMenit: number | null
}

export interface ReportSummary {
  id: string
  createdAt: number
  updatedAt: number
  status: ReportStatus
  createdBy: string | null
  tanggal: string
  jam: string
  nopol: string
  produk: string
  noSO: string
  noLOs: string[]
  loIds: string[]
  doneCount: number
  volumeDO: number | null
  gainLoss: number | null
  densityAnomaly: boolean
  /** Klasifikasi shift dari jam datang MT. */
  shift: Shift | null
  tanggalShift: string
  tankId: string
  stokAwal: number | null
  realStok: number | null
  /** Volume penerimaan aktual (ATG akhir - ATG awal + penjualan selama bongkar). */
  terimaAktual: number | null
  /** Rata-rata density 15°C hasil uji di SPBU dan density 15°C dokumen depot. */
  d15: number | null
  d15Depot: number | null
  densityOk: boolean | null
  /** Field berikut tidak ada pada ringkasan lama. */
  jamSelesai?: string
  noBA?: string
  /** Penanda tangan yang belum tanda tangan. */
  ttdKurang?: SignerKey[]
  sample2Jam?: { tanggal: string; jam: string; d15: number | null; selisih: number | null; ok: boolean | null } | null
  /** Untuk kartu kaleng sample: penerima/petugas uji, nomor kompartemen yang diuji, hasil uji air. */
  petugas?: string
  kompartemen?: string[]
  airNihil?: boolean | null
  segelOk?: boolean
  planId?: string
  namaDriver?: string
  /** Total selisih liter kompartemen (transport loss). */
  transportLoss?: number | null
  /** Discharge gain/loss dalam persen volume penerimaan (DO). */
  gainLossPct?: number | null
  /** Gate out depot (ISO tanggal + jam). */
  tanggalKeluar?: string
  jamKeluar?: string
}

export interface Rules {
  densityTolerance: number
  teraToleranceMm: number
  atgSettleMinutes: number
  literPerDO: number
}

export interface Settings {
  namaSpbu: string
  kodeSpbu: string
  alamatSpbu: string
  logoDataUrl: string
  namaPetugasDefault: string
  namaPengawasDefault: string
  pinPenanggungJawab: string
  namaAbhDefault: string
  namaSecurityDefault: string
  perusahaanPengangkut: string
  nozzles: Nozzle[]
  rules: Rules
}

export interface Nozzle {
  id: string
  nama: string
  produk: string
}

export const PRODUK_OPTIONS = ['Pertalite', 'Pertamax', 'Pertamax Turbo', 'Biosolar', 'Pertamina Dex']

export const DEFAULT_RULES: Rules = {
  densityTolerance: 0.003,
  teraToleranceMm: 10,
  atgSettleMinutes: 10,
  literPerDO: 8000,
}

export type PhotoSlotDef = { key: string; label: string; optional?: boolean }
export interface StepDef {
  id: StepId
  title: string
  desc: string
  photos: PhotoSlotDef[]
}

export type StepId =
  | 'mt'
  | 'lo'
  | 'tera'
  | 'atg_before'
  | 'safety'
  | 'segel'
  | 'dip_before'
  | 'water'
  | 'dip_mt'
  | 'sampel'
  | 'density'
  | 'hose'
  | 'atg_after'
  | 'dip_after'

export const STEPS: StepDef[] = [
  {
    id: 'mt',
    title: 'Foto Mobil Tangki',
    desc: 'Foto mobil tangki bagian depan dengan nomor polisi terlihat jelas, lalu isi nomor polisinya.',
    photos: [{ key: 'mt_depan', label: 'Mobil tangki tampak depan (nopol terlihat)' }],
  },
  {
    id: 'lo',
    title: 'Dokumen LO & Data Bongkaran',
    desc: 'Foto dokumen LO, pilih SO & LO yang datang dari Plan, lalu isi data LO mobil tangki.',
    photos: [{ key: 'dok_lo', label: 'Dokumen LO mobil tangki' }],
  },
  {
    id: 'tera',
    title: 'Buku Tera Mobil Tangki',
    desc: 'Foto buku tera MT, isi tinggi tera dan kapasitas tiap kompartemen.',
    photos: [{ key: 'buku_tera', label: 'Buku tera mobil tangki' }],
  },
  {
    id: 'atg_before',
    title: 'ATG Sebelum Pembongkaran',
    desc: 'Foto layar ATG sebelum bongkar, isi ketinggian, volume, dan suhu (dipakai sebagai stok awal).',
    photos: [{ key: 'atg_before', label: 'Layar ATG sebelum pembongkaran' }],
  },
  {
    id: 'safety',
    title: 'Kelengkapan Safety',
    desc: 'APAR DCP minimal 9 kg tersedia di area bongkar, kabel arde terpasang, petugas memakai atribut safety.',
    photos: [{ key: 'safety', label: 'APAR, kabel arde & atribut safety petugas' }],
  },
  {
    id: 'segel',
    title: 'Segel Kompartemen',
    desc: 'Foto segel kompartemen atas dan bawah, cocokkan nomornya dengan nomor segel di data LO.',
    photos: [{ key: 'segel', label: 'Segel kompartemen atas & bawah' }],
  },
  {
    id: 'dip_before',
    title: 'Deepstick Tangki Pendam (Sebelum)',
    desc: 'Foto hasil deepstick ketinggian minyak tangki pendam SPBU sebelum bongkar, isi ketinggian (mm).',
    photos: [{ key: 'dip_before', label: 'Deepstick tangki pendam sebelum bongkar' }],
  },
  {
    id: 'water',
    title: 'Water Content Kompartemen MT',
    desc: 'Foto deepstick pasta air pada kompartemen MT. Wajib nihil (pasta tidak berubah warna).',
    photos: [
      { key: 'water', label: 'Deepstick pasta air kompartemen MT' },
      { key: 'draining', label: 'Proses draining', optional: true },
    ],
  },
  {
    id: 'dip_mt',
    title: 'Deepstick Kompartemen MT vs Buku Tera',
    desc: 'Isi ketinggian minyak tiap kompartemen hasil deepstick, dibandingkan dengan tinggi tera.',
    photos: [{ key: 'dip_mt', label: 'Deepstick ketinggian minyak mobil tangki' }],
  },
  {
    id: 'sampel',
    title: 'Sampel Minyak Kompartemen',
    desc: 'Foto sampel minyak kompartemen atas dan bawah, keduanya harus sesuai.',
    photos: [
      { key: 'sampel_atas', label: 'Sampel minyak atas' },
      { key: 'sampel_bawah', label: 'Sampel minyak bawah' },
    ],
  },
  {
    id: 'density',
    title: 'Kualitas Density',
    desc: 'Pilih kompartemen, isi density pengukuran & suhu. Density 15°C dihitung otomatis dan dibandingkan dengan dokumen DO depot.',
    photos: [{ key: 'density', label: 'Pembacaan hidrometer & termometer', optional: true }],
  },
  {
    id: 'hose',
    title: 'Hose & Fillport',
    desc: 'Foto hose MT yang terpasang pada fillport tangki pendam yang sesuai produk.',
    photos: [{ key: 'hose_fillport', label: 'Hose MT terpasang pada fillport sesuai produk' }],
  },
  {
    id: 'atg_after',
    title: 'ATG Setelah Pengisian',
    desc: 'Diamkan minimal 10 menit agar minyak stabil, lalu foto ATG dan isi ketinggian, volume, dan suhu.',
    photos: [{ key: 'atg_after', label: 'Layar ATG setelah pengisian' }],
  },
  {
    id: 'dip_after',
    title: 'Dipping Manual Tangki Pendam (Sesudah)',
    desc: 'Foto dipping manual tangki pendam setelah pembongkaran, isi ketinggian (mm), lalu tanda tangan penerima, security, dan supir tangki.',
    photos: [{ key: 'dip_after', label: 'Dipping tangki pendam setelah bongkar' }],
  },
]

export function newCompartment(no = ''): Compartment {
  return { id: genId('k'), no, tinggiTera: '', kapasitas: '', kepekaan: '', dipAktual: '', noSegel: '' }
}

/** Foto slot gabungan; laporan lama menyimpan foto di dua slot terpisah. */
export const LEGACY_PHOTO_SLOTS: Record<string, { key: string; label: string }[]> = {
  segel: [
    { key: 'segel_atas', label: 'Segel kompartemen atas' },
    { key: 'segel_bawah', label: 'Segel kompartemen bawah' },
  ],
  hose_fillport: [
    { key: 'hose', label: 'Hose terpasang' },
    { key: 'fillport', label: 'Fillport tangki pendam' },
  ],
}

export function slotHasPhoto(photos: Photos, key: string) {
  if ((photos[key] ?? []).length) return true
  const legacy = LEGACY_PHOTO_SLOTS[key]
  return !!legacy && legacy.every((l) => (photos[l.key] ?? []).length)
}

/** Lengkapi field yang belum ada pada laporan lama. */
export function normalizeReport(r: Report): Report {
  const d = r.data
  return {
    ...r,
    data: {
      ...d,
      shipTo: d.shipTo ?? d.soldTo ?? '',
      volumeDO: d.volumeDO ?? '',
      segelLO: d.segelLO ?? [],
      perusahaanPengangkut: d.perusahaanPengangkut ?? '',
      totalisator: d.totalisator ?? [],
      ttd: d.ttd ?? {},
      compartments: d.compartments.map((c) => ({ ...c, kapasitas: c.kapasitas ?? '', noSegel: c.noSegel ?? '' })),
    },
  }
}

export function newDensityTest(kompartemenId = ''): DensityTest {
  return { id: genId('d'), kompartemenId, densityObs: '', suhu: '' }
}

export function blankReport(settings: Settings, createdBy: string | null): Report {
  const now = Date.now()
  return {
    id: genId('r'),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    finishedAt: null,
    createdBy,
    photos: {},
    data: {
      planId: '',
      noSO: '',
      loIds: [],
      noLOs: [],
      tanggalDatang: todayIso(),
      jamDatang: nowHm(),
      nopol: '',
      namaDriver: '',
      soldTo: '',
      shipTo: '',
      produk: '',
      jumlahDO: '',
      volumeDO: '',
      segelLO: [],
      perusahaanPengangkut: settings.perusahaanPengangkut || 'PERTAMINA PATRA NIAGA',
      densityObsDepot: '',
      suhuObsDepot: '',
      density15Depot: '',
      tanggalKeluar: '',
      jamKeluar: '',
      compartments: [newCompartment('1')],
      tankId: '',
      atgBefore: { tinggi: '', volume: '', suhu: '' },
      safetyApar: false,
      safetyArde: false,
      safetyAtribut: false,
      segelSesuai: false,
      dipBeforeMm: '',
      airNihil: null,
      teraApproval: null,
      sampelSesuai: false,
      densityTests: [],
      fillportSesuai: false,
      jamSelesaiBongkar: '',
      jamBacaAtg: '',
      atgAfter: { tinggi: '', volume: '', suhu: '' },
      penjualanSelamaBongkar: '',
      totalisator: [],
      dipAfterMm: '',
      ttd: {
        penerima: { nama: settings.namaPetugasDefault, img: '', at: '' },
        security: { nama: settings.namaSecurityDefault, img: '', at: '' },
        pengawas: { nama: settings.namaPengawasDefault, img: '', at: '' },
        abh: { nama: settings.namaAbhDefault, img: '', at: '' },
      },
      noBA: '',
      namaPetugas: settings.namaPetugasDefault,
      namaPengawas: settings.namaPengawasDefault,
      catatan: '',
    },
  }
}

const has = (v: string | null | undefined) => v !== null && v !== undefined && v.trim() !== ''
const num = (v: string | null | undefined) => parseAngka(v ?? '')

export interface CompartmentResult extends Compartment {
  selisihMm: number | null
  estLiter: number | null
  outOfLimit: boolean
}

export interface TotalisatorResult extends Totalisator {
  jual: number | null
}

export interface DensityResult extends DensityTest {
  kompartemenNo: string
  obs: number | null
  d15: Density15 | null
  selisih: number | null
  ok: boolean | null
}

export interface Derived {
  tank: Tank | null
  d15Depot: number | null
  depotCalc: Density15 | null
  compartments: CompartmentResult[]
  teraOutOfLimit: boolean
  densityResults: DensityResult[]
  densityAnomaly: boolean
  volumeDO: number | null
  /** Total selisih liter semua kompartemen (transport loss). */
  transportLoss: number | null
  /** Batas toleransi transport loss: -0,15% dari total kapasitas kompartemen. */
  transportLossLimit: number | null
  totalisator: TotalisatorResult[]
  terimaAktual: number | null
  shift: Shift | null
  tanggalShift: string
  stokAwal: number | null
  penjualan: number
  stokTeoritis: number | null
  realStok: number | null
  gainLoss: number | null
  gainLossPct: number | null
  dipBefore: VolumeResult | null
  dipAfter: VolumeResult | null
  atgBeforeTable: VolumeResult | null
  atgAfterTable: VolumeResult | null
  diterimaDip: number | null
  gainLossDip: number | null
  settleMinutes: number | null
  sample2Jam: Sample2JamResult | null
}

/** Menit dari bongkar selesai sampai sampel diambil (melewati tengah malam bila jam selesai < jam datang). */
export function sampleJeda(d: Pick<ReportData, 'tanggalDatang' | 'jamDatang' | 'jamSelesaiBongkar'>, tanggal: string, jam: string): number | null {
  if (!d.tanggalDatang || !d.jamSelesaiBongkar || !tanggal || !jam) return null
  const selesai = new Date(`${d.tanggalDatang}T${d.jamSelesaiBongkar}:00`)
  if (d.jamDatang && d.jamSelesaiBongkar < d.jamDatang) selesai.setDate(selesai.getDate() + 1)
  const ambil = new Date(`${tanggal}T${jam}:00`)
  const m = Math.round((ambil.getTime() - selesai.getTime()) / 60000)
  return Number.isFinite(m) ? m : null
}

/** Semua angka turunan yang dipakai di form, Berita Acara, dan template WhatsApp. */
export function deriveReport(report: Report, rules: Rules): Derived {
  const d = report.data
  const d15Depot = normalizeDensity(d.density15Depot)

  const compartments = d.compartments.map((c) => {
    const tera = num(c.tinggiTera)
    const dip = num(c.dipAktual)
    const kapasitas = num(c.kapasitas)
    const kepekaan = kapasitas !== null && tera ? kapasitas / tera : num(c.kepekaan)
    const selisihMm = tera !== null && dip !== null ? dip - tera : null // negatif = kurang dari tera
    // Sama dengan Berita Acara: selisih (mm) x kapasitas / tinggi tera.
    const estLiter = selisihMm !== null && kepekaan !== null ? selisihMm * kepekaan : null
    const outOfLimit = selisihMm !== null && -selisihMm > rules.teraToleranceMm
    return { ...c, selisihMm, estLiter, outOfLimit }
  })

  const densityResults = d.densityTests.map((t) => {
    const comp = d.compartments.find((c) => c.id === t.kompartemenId)
    const res = density15(t.densityObs, t.suhu)
    const selisih = res && d15Depot !== null ? Math.round((res.value - d15Depot) * 10000) / 10000 : null
    const ok = selisih !== null ? Math.abs(selisih) <= rules.densityTolerance + 1e-9 : null
    return { ...t, kompartemenNo: comp ? comp.no : '-', obs: normalizeDensity(t.densityObs), d15: res, selisih, ok }
  })

  const jumlahDO = num(d.jumlahDO)
  const volumeDO = num(d.volumeDO ?? '') ?? (jumlahDO !== null ? jumlahDO * rules.literPerDO : null)
  const stokAwal = num(d.atgBefore.volume)
  const totalisator = (d.totalisator ?? []).map((t) => {
    const awal = num(t.awal)
    const akhir = num(t.akhir)
    return { ...t, jual: awal !== null && akhir !== null ? akhir - awal : null }
  })
  const jualNozzle = totalisator.filter((t) => t.jual !== null)
  const penjualan = jualNozzle.length ? jualNozzle.reduce((n, t) => n + (t.jual ?? 0), 0) : (num(d.penjualanSelamaBongkar) ?? 0)
  const stokTeoritis = stokAwal !== null && volumeDO !== null ? stokAwal + volumeDO - penjualan : null
  const realStok = num(d.atgAfter.volume)
  const gainLoss = stokTeoritis !== null && realStok !== null ? realStok - stokTeoritis : null
  const gainLossPct = gainLoss !== null && volumeDO ? (gainLoss / volumeDO) * 100 : null

  const dipBefore = volumeFromLevel(d.tankId, d.dipBeforeMm)
  const dipAfter = volumeFromLevel(d.tankId, d.dipAfterMm)
  const diterimaDip =
    dipBefore?.volume !== undefined && dipAfter?.volume !== undefined ? dipAfter.volume - dipBefore.volume + penjualan : null

  const literComps = compartments.filter((c) => c.estLiter !== null)
  const kapasitasTotal = d.compartments.reduce((n, c) => n + (num(c.kapasitas) ?? 0), 0)
  const sk = shiftKey(d.tanggalDatang, d.jamDatang)

  return {
    tank: getTank(d.tankId),
    transportLoss: literComps.length ? literComps.reduce((n, c) => n + (c.estLiter ?? 0), 0) : null,
    transportLossLimit: kapasitasTotal ? kapasitasTotal * -0.0015 : null,
    totalisator,
    terimaAktual: realStok !== null && stokAwal !== null ? realStok - stokAwal + penjualan : null,
    shift: sk?.shift ?? null,
    tanggalShift: sk?.tanggal ?? d.tanggalDatang,
    d15Depot,
    depotCalc: density15(d.densityObsDepot, d.suhuObsDepot),
    compartments,
    teraOutOfLimit: compartments.some((c) => c.outOfLimit),
    densityResults,
    densityAnomaly: densityResults.some((r) => r.ok === false),
    volumeDO,
    stokAwal,
    penjualan,
    stokTeoritis,
    realStok,
    gainLoss,
    gainLossPct,
    dipBefore,
    dipAfter,
    atgBeforeTable: volumeFromLevel(d.tankId, d.atgBefore.tinggi),
    atgAfterTable: volumeFromLevel(d.tankId, d.atgAfter.tinggi),
    diterimaDip,
    gainLossDip: diterimaDip !== null && volumeDO !== null ? diterimaDip - volumeDO : null,
    settleMinutes: minutesBetween(d.jamSelesaiBongkar, d.jamBacaAtg),
    sample2Jam: deriveSample(d, d15Depot, rules),
  }
}

function deriveSample(d: ReportData, d15Depot: number | null, rules: Rules): Sample2JamResult | null {
  const s = d.sample2Jam
  if (!s) return null
  const res = density15(s.densityObs, s.suhu)
  const selisih = res && d15Depot !== null ? Math.round((res.value - d15Depot) * 10000) / 10000 : null
  return {
    d15: res,
    selisih,
    ok: selisih !== null ? Math.abs(selisih) <= rules.densityTolerance + 1e-9 : null,
    jedaMenit: sampleJeda(d, s.tanggal, s.jam),
  }
}

export interface StepEval {
  complete: boolean
  issues: string[]
  anomaly: boolean
  needsApproval: boolean
}

function evaluateStep(step: StepDef, report: Report, x: Derived, rules: Rules): StepEval {
  const d = report.data
  const issues = step.photos
    .filter((p) => !p.optional && !slotHasPhoto(report.photos, p.key))
    .map((p) => `Foto "${p.label}" belum diupload`)
  const nozzles = d.totalisator ?? []
  let anomaly = false
  let needsApproval = false

  switch (step.id) {
    case 'mt':
      if (!has(d.nopol)) issues.push('Isi nomor polisi mobil tangki')
      break
    case 'lo':
      if (!d.planId || d.loIds.length === 0) issues.push('Pilih SO dan LO dari Plan')
      if (!has(d.tanggalDatang) || !has(d.jamDatang)) issues.push('Isi tanggal & jam kedatangan MT')
      if (!has(d.namaDriver)) issues.push('Isi nama lengkap driver')
      if (!has(d.shipTo)) issues.push('Isi nomor Ship To')
      if (!((x.volumeDO ?? 0) > 0)) issues.push('Isi volume DO (liter)')
      if (normalizeDensity(d.densityObsDepot) === null || num(d.suhuObsDepot) === null) issues.push('Isi density & temperature (OBS) depot')
      if (x.d15Depot === null) issues.push('Isi density at 15°C dari dokumen depot')
      if (d.compartments.length === 0 || d.compartments.some((c) => !has(c.no))) issues.push('Isi nomor kompartemen')
      if (!has(d.tanggalKeluar) || !has(d.jamKeluar)) issues.push('Isi tanggal & jam keluar MT dari depot')
      break
    case 'tera':
      if (d.compartments.some((c) => !((num(c.tinggiTera) ?? 0) > 0) || !((num(c.kapasitas) ?? 0) > 0 || (num(c.kepekaan) ?? 0) > 0))) {
        issues.push('Isi tinggi tera & kapasitas untuk semua kompartemen')
      }
      break
    case 'atg_before':
      if (!d.tankId) issues.push('Pilih tangki pendam')
      if ([d.atgBefore.tinggi, d.atgBefore.volume, d.atgBefore.suhu].some((v) => num(v) === null)) {
        issues.push('Isi ketinggian, volume, dan suhu pembacaan ATG')
      }
      if (nozzles.some((t) => num(t.awal) === null)) issues.push('Isi totalisator awal semua nozzle produk ini')
      break
    case 'safety':
      if (!d.safetyApar) issues.push('Konfirmasi APAR DCP min. 9 kg tersedia')
      if (!d.safetyArde) issues.push('Konfirmasi kabel arde terpasang')
      if (!d.safetyAtribut) issues.push('Konfirmasi petugas memakai atribut safety')
      break
    case 'segel':
      if (d.compartments.some((c) => !has(c.noSegel))) issues.push('Isi nomor segel tiap kompartemen')
      if (!d.segelSesuai) issues.push('Konfirmasi nomor segel sesuai data LO')
      break
    case 'dip_before':
      if (num(d.dipBeforeMm) === null) issues.push('Isi ketinggian deepstick tangki pendam (mm)')
      break
    case 'water':
      if (d.airNihil === null) issues.push('Pilih hasil water content: nihil atau terdapat air')
      if (d.airNihil === false && !(report.photos.draining ?? []).length) {
        issues.push('Terdapat air: lakukan draining terlebih dahulu dan lampirkan foto draining')
      }
      break
    case 'dip_mt':
      if (d.compartments.some((c) => num(c.dipAktual) === null)) issues.push('Isi hasil deepstick semua kompartemen')
      else if (x.teraOutOfLimit && !d.teraApproval) {
        needsApproval = true
        issues.push(`Selisih dengan buku tera melebihi ${rules.teraToleranceMm} mm, butuh izin penanggung jawab`)
      }
      break
    case 'sampel':
      if (!d.sampelSesuai) issues.push('Konfirmasi sampel atas & bawah sesuai')
      break
    case 'density':
      if (x.d15Depot === null) issues.push('Density 15°C depot belum diisi (tahap Dokumen LO)')
      if (x.densityResults.length === 0) issues.push('Tambahkan minimal satu pengukuran density')
      if (x.densityResults.some((r) => !r.kompartemenId || !r.d15)) issues.push('Lengkapi kompartemen, density, dan suhu pada setiap pengukuran')
      if (x.densityAnomaly) {
        anomaly = true
        issues.push(`Selisih density melebihi toleransi ${String(rules.densityTolerance).replace('.', ',')}, pembongkaran tidak dapat dilanjutkan`)
      }
      break
    case 'hose':
      if (!d.fillportSesuai) issues.push('Konfirmasi hose terpasang pada fillport yang sesuai produk')
      break
    case 'atg_after':
      if (!has(d.jamSelesaiBongkar) || !has(d.jamBacaAtg)) issues.push('Isi jam selesai bongkar dan jam pembacaan ATG')
      else if ((x.settleMinutes ?? 0) < rules.atgSettleMinutes) {
        issues.push(`ATG baru dibaca ${x.settleMinutes} menit setelah selesai bongkar, minimal ${rules.atgSettleMinutes} menit`)
      }
      if ([d.atgAfter.tinggi, d.atgAfter.volume, d.atgAfter.suhu].some((v) => num(v) === null)) {
        issues.push('Isi ketinggian, volume, dan suhu pembacaan ATG')
      }
      if (nozzles.some((t) => num(t.akhir) === null)) issues.push('Isi totalisator akhir semua nozzle produk ini')
      else if (x.totalisator.some((t) => (t.jual ?? 0) < 0)) issues.push('Totalisator akhir tidak boleh lebih kecil dari totalisator awal')
      break
    case 'dip_after':
      if (num(d.dipAfterMm) === null) issues.push('Isi ketinggian dipping tangki pendam (mm)')
      for (const s of SIGNERS.filter((s) => s.wajib)) {
        const t = d.ttd?.[s.key]
        // Nama supir mengikuti nama driver di dokumen LO bila belum diubah.
        if (!has(t?.nama || (s.key === 'supir' ? d.namaDriver : ''))) issues.push(`Isi nama ${s.label.toLowerCase()}`)
        else if (!t?.img) issues.push(`Tanda tangan ${s.label.toLowerCase()} belum ada`)
      }
      break
    default:
      break
  }
  return { complete: issues.length === 0, issues, anomaly, needsApproval }
}

export interface StepState extends StepDef, StepEval {
  locked: boolean
}

export interface Evaluation {
  derived: Derived
  steps: StepState[]
  doneCount: number
  allComplete: boolean
  /** Anomali density pada tahap yang sudah terbuka: proses berhenti. */
  densityAnomaly: boolean
}

/** Status tiap tahap + penguncian berurutan (tahap berikutnya terbuka setelah tahap sebelumnya lengkap). */
export function evaluateAll(report: Report, rules: Rules): Evaluation {
  const derived = deriveReport(report, rules)
  let blocked = false
  const steps = STEPS.map((step) => {
    const ev = evaluateStep(step, report, derived, rules)
    const locked = blocked
    if (!ev.complete) blocked = true
    return { ...step, ...ev, locked }
  })
  const densityStep = steps.find((s) => s.id === 'density')
  return {
    derived,
    steps,
    doneCount: steps.filter((s) => s.complete && !s.locked).length,
    allComplete: steps.every((s) => s.complete),
    densityAnomaly: derived.densityAnomaly && !densityStep?.locked,
  }
}

export function summarize(report: Report, ev: Evaluation): ReportSummary {
  const d = report.data
  const x = ev.derived
  const d15s = x.densityResults.map((r) => r.d15?.value).filter((v): v is number => typeof v === 'number')
  return {
    id: report.id,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    status: report.status,
    createdBy: report.createdBy,
    tanggal: d.tanggalDatang,
    jam: d.jamDatang,
    nopol: d.nopol,
    produk: d.produk,
    noSO: d.noSO,
    noLOs: d.noLOs,
    loIds: d.loIds,
    doneCount: ev.doneCount,
    volumeDO: ev.derived.volumeDO,
    gainLoss: ev.derived.gainLoss,
    densityAnomaly: ev.densityAnomaly,
    shift: x.shift,
    tanggalShift: x.tanggalShift,
    tankId: d.tankId,
    stokAwal: x.stokAwal,
    realStok: x.realStok,
    terimaAktual: x.terimaAktual,
    d15: d15s.length ? Math.round((d15s.reduce((n, v) => n + v, 0) / d15s.length) * 10000) / 10000 : null,
    d15Depot: x.d15Depot,
    densityOk: x.densityResults.length ? x.densityResults.every((r) => r.ok !== false) : null,
    jamSelesai: d.jamSelesaiBongkar,
    petugas: d.ttd?.penerima?.nama || d.namaPetugas,
    kompartemen: [...new Set(x.densityResults.map((r) => r.kompartemenNo).filter((n) => n && n !== '-'))],
    airNihil: d.airNihil,
    segelOk: d.segelSesuai,
    planId: d.planId,
    namaDriver: d.namaDriver,
    transportLoss: x.transportLoss,
    gainLossPct: x.gainLossPct,
    tanggalKeluar: d.tanggalKeluar,
    jamKeluar: d.jamKeluar,
    noBA: d.noBA,
    ttdKurang: SIGNERS.filter((s) => !d.ttd?.[s.key]?.img).map((s) => s.key),
    sample2Jam:
      d.sample2Jam && x.sample2Jam
        ? { tanggal: d.sample2Jam.tanggal, jam: d.sample2Jam.jam, d15: x.sample2Jam.d15?.value ?? null, selisih: x.sample2Jam.selisih, ok: x.sample2Jam.ok }
        : null,
  }
}

export function suggestNoBA(settings: Settings, report: Report) {
  const d = new Date(`${report.data.tanggalDatang || todayIso()}T00:00:00`)
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][d.getMonth()]
  const nopol = (report.data.nopol || 'MT').replace(/\s+/g, '')
  return `BA-BONGKAR/${settings.kodeSpbu || 'SPBU'}/${nopol}/${roman}/${d.getFullYear()}`
}

export function effectiveRules(r: Partial<Record<keyof Rules, unknown>> | undefined): Rules {
  const out = { ...DEFAULT_RULES }
  for (const k of Object.keys(DEFAULT_RULES) as (keyof Rules)[]) {
    const v = r?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}
