/**
 * Alur SOP pembongkaran BBM: tipe data, definisi tahapan, validasi tiap
 * tahap, dan perhitungan kuantitas/kualitas untuk Berita Acara.
 */
import { density15, normalizeDensity, type Density15 } from '@/lib/density'
import { minutesBetween, nowHm, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
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
  kepekaan: string
  dipAktual: string
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

export interface ReportData {
  planId: string
  noSO: string
  loIds: string[]
  noLOs: string[]
  tanggalDatang: string
  jamDatang: string
  nopol: string
  namaDriver: string
  soldTo: string
  produk: string
  jumlahDO: string
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
  dipAfterMm: string
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

export interface PlanLo {
  id: string
  noLO: string
  jumlahDO: number
}

export interface Plan {
  id: string
  createdAt: number
  tanggal: string
  noSO: string
  produk: string
  soldTo: string
  los: PlanLo[]
}

/** Ringkasan per laporan untuk daftar, beranda, dan penanda LO terpakai. */
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
  rules: Rules
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
    desc: 'Foto mobil tangki bagian depan, nomor polisi harus terlihat jelas.',
    photos: [{ key: 'mt_depan', label: 'Mobil tangki tampak depan (nopol terlihat)' }],
  },
  {
    id: 'lo',
    title: 'Dokumen LO & Data Bongkaran',
    desc: 'Foto dokumen LO, pilih SO & LO yang datang dari Plan Kirim, lalu isi data LO mobil tangki.',
    photos: [{ key: 'dok_lo', label: 'Dokumen LO mobil tangki' }],
  },
  {
    id: 'tera',
    title: 'Buku Tera Mobil Tangki',
    desc: 'Foto buku tera MT, isi tinggi tera dan kepekaan tiap kompartemen.',
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
    desc: 'Foto segel kompartemen atas dan bawah, pastikan sesuai list DO/LO.',
    photos: [
      { key: 'segel_atas', label: 'Segel kompartemen atas' },
      { key: 'segel_bawah', label: 'Segel kompartemen bawah' },
    ],
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
    desc: 'Foto hose terpasang dengan baik dan fillport tangki pendam yang sesuai produk.',
    photos: [
      { key: 'hose', label: 'Hose terpasang' },
      { key: 'fillport', label: 'Fillport tangki pendam' },
    ],
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
    desc: 'Foto dipping manual tangki pendam setelah pembongkaran, isi ketinggian (mm).',
    photos: [{ key: 'dip_after', label: 'Dipping tangki pendam setelah bongkar' }],
  },
]

export function newCompartment(no = ''): Compartment {
  return { id: genId('k'), no, tinggiTera: '', kepekaan: '', dipAktual: '' }
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
      produk: '',
      jumlahDO: '',
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
      dipAfterMm: '',
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
}

/** Semua angka turunan yang dipakai di form, Berita Acara, dan template WhatsApp. */
export function deriveReport(report: Report, rules: Rules): Derived {
  const d = report.data
  const d15Depot = normalizeDensity(d.density15Depot)

  const compartments = d.compartments.map((c) => {
    const tera = num(c.tinggiTera)
    const dip = num(c.dipAktual)
    const kepekaan = num(c.kepekaan)
    const selisihMm = tera !== null && dip !== null ? dip - tera : null // negatif = kurang dari tera
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
  const volumeDO = jumlahDO !== null ? jumlahDO * rules.literPerDO : null
  const stokAwal = num(d.atgBefore.volume)
  const penjualan = num(d.penjualanSelamaBongkar) ?? 0
  const stokTeoritis = stokAwal !== null && volumeDO !== null ? stokAwal + volumeDO - penjualan : null
  const realStok = num(d.atgAfter.volume)
  const gainLoss = stokTeoritis !== null && realStok !== null ? realStok - stokTeoritis : null
  const gainLossPct = gainLoss !== null && volumeDO ? (gainLoss / volumeDO) * 100 : null

  const dipBefore = volumeFromLevel(d.tankId, d.dipBeforeMm)
  const dipAfter = volumeFromLevel(d.tankId, d.dipAfterMm)
  const diterimaDip =
    dipBefore?.volume !== undefined && dipAfter?.volume !== undefined ? dipAfter.volume - dipBefore.volume + penjualan : null

  return {
    tank: getTank(d.tankId),
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
    .filter((p) => !p.optional && !(report.photos[p.key] ?? []).length)
    .map((p) => `Foto "${p.label}" belum diupload`)
  let anomaly = false
  let needsApproval = false

  switch (step.id) {
    case 'lo':
      if (!d.planId || d.loIds.length === 0) issues.push('Pilih SO dan LO dari Plan Kirim')
      if (!has(d.tanggalDatang) || !has(d.jamDatang)) issues.push('Isi tanggal & jam kedatangan MT')
      if (!has(d.nopol)) issues.push('Isi nomor polisi MT')
      if (!has(d.namaDriver)) issues.push('Isi nama lengkap driver')
      if (!has(d.soldTo)) issues.push('Isi nomor Sold To')
      if (!((num(d.jumlahDO) ?? 0) > 0)) issues.push('Isi jumlah DO')
      if (normalizeDensity(d.densityObsDepot) === null || num(d.suhuObsDepot) === null) issues.push('Isi density & temperature (OBS) depot')
      if (x.d15Depot === null) issues.push('Isi density at 15°C dari dokumen depot')
      if (d.compartments.length === 0 || d.compartments.some((c) => !has(c.no))) issues.push('Isi nomor kompartemen')
      if (!has(d.tanggalKeluar) || !has(d.jamKeluar)) issues.push('Isi tanggal & jam keluar MT dari depot')
      break
    case 'tera':
      if (d.compartments.some((c) => !((num(c.tinggiTera) ?? 0) > 0) || !((num(c.kepekaan) ?? 0) > 0))) {
        issues.push('Isi tinggi tera & kepekaan untuk semua kompartemen')
      }
      break
    case 'atg_before':
      if (!d.tankId) issues.push('Pilih tangki pendam')
      if ([d.atgBefore.tinggi, d.atgBefore.volume, d.atgBefore.suhu].some((v) => num(v) === null)) {
        issues.push('Isi ketinggian, volume, dan suhu pembacaan ATG')
      }
      break
    case 'safety':
      if (!d.safetyApar) issues.push('Konfirmasi APAR DCP min. 9 kg tersedia')
      if (!d.safetyArde) issues.push('Konfirmasi kabel arde terpasang')
      if (!d.safetyAtribut) issues.push('Konfirmasi petugas memakai atribut safety')
      break
    case 'segel':
      if (!d.segelSesuai) issues.push('Konfirmasi segel sesuai list DO/LO')
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
        issues.push(`Selisih dengan buku tera melebihi ${rules.teraToleranceMm} mm — butuh izin penanggung jawab`)
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
        issues.push(`Selisih density melebihi toleransi ${String(rules.densityTolerance).replace('.', ',')} — pembongkaran tidak dapat dilanjutkan`)
      }
      break
    case 'hose':
      if (!d.fillportSesuai) issues.push('Konfirmasi fillport sesuai produk')
      break
    case 'atg_after':
      if (!has(d.jamSelesaiBongkar) || !has(d.jamBacaAtg)) issues.push('Isi jam selesai bongkar dan jam pembacaan ATG')
      else if ((x.settleMinutes ?? 0) < rules.atgSettleMinutes) {
        issues.push(`ATG baru dibaca ${x.settleMinutes} menit setelah selesai bongkar — minimal ${rules.atgSettleMinutes} menit`)
      }
      if ([d.atgAfter.tinggi, d.atgAfter.volume, d.atgAfter.suhu].some((v) => num(v) === null)) {
        issues.push('Isi ketinggian, volume, dan suhu pembacaan ATG')
      }
      break
    case 'dip_after':
      if (num(d.dipAfterMm) === null) issues.push('Isi ketinggian dipping tangki pendam (mm)')
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
