import { bejanaStatus, type DailyRecord, type QqRecord, type StokRecord } from '@/lib/daily'
import { addDays, hariSingkat, sameDay, startOfWeek, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { loStatus } from '@/lib/plan'
import { PRODUK_OPTIONS, type Nozzle, type Plan, type ReportSummary } from '@/lib/sop'

/** Status Q&Q di pill: sesuai (selesai), perhatian (anomali), belum (draft / belum ada). */
export type QQStatus = 'sesuai' | 'perhatian' | 'belum'

export interface CalendarDay {
  label: string
  date: number
  status: 'sesuai' | 'catatan' | 'belum'
  isToday?: boolean
}

export interface ProductStatus {
  name: string
  status: QQStatus
  note: string
}

export function qqOf(r: Pick<ReportSummary, 'status' | 'densityAnomaly'>): QQStatus {
  if (r.status === 'selesai') return 'sesuai'
  if (r.status === 'anomali' || r.densityAnomaly) return 'perhatian'
  return 'belum'
}

export function labelQQ(r: Pick<ReportSummary, 'status' | 'densityAnomaly' | 'doneCount'>, totalSteps: number) {
  if (r.status === 'selesai') return 'Q&Q Sesuai'
  if (r.status === 'anomali') return 'Anomali density'
  if (r.densityAnomaly) return 'Anomali density'
  return `Tahap ${Math.min(r.doneCount + 1, totalSteps)}/${totalSteps}`
}

/** Angka hari ini dari daftar laporan. */
export function ringkasHariIni(rows: ReportSummary[], now = new Date()) {
  const today = rows.filter((r) => r.tanggal === todayIso(now))
  const selesai = today.filter((r) => r.status === 'selesai')
  return {
    totalLiter: selesai.reduce((sum, r) => sum + (r.volumeDO ?? 0), 0),
    mobilTangki: today.length,
    gainLoss: selesai.reduce((sum, r) => sum + (r.gainLoss ?? 0), 0),
    qqSesuai: selesai.length,
    qqTotal: today.length,
    perluCek: today.filter((r) => qqOf(r) === 'perhatian'),
  }
}

/** Status terakhir per produk minggu ini. */
export function statusProduk(rows: ReportSummary[]): ProductStatus[] {
  return PRODUK_OPTIONS.map((name) => {
    const last = rows.find((r) => r.produk === name)
    if (!last) return { name, status: 'belum', note: 'Belum input' }
    const status = qqOf(last)
    return { name, status, note: status === 'sesuai' ? 'Sesuai' : status === 'perhatian' ? 'Anomali' : 'Dalam proses' }
  })
}

/** Senin-Minggu dari minggu yang memuat `anchor`: sesuai bila bongkaran selesai tanpa anomali, catatan bila ada anomali atau bejana lewat batas. */
export function kalenderMinggu(rows: ReportSummary[], anchor: Date, daily: DailyRecord[] = [], now = new Date()): (CalendarDay & { iso: string })[] {
  const monday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const iso = todayIso(day)
    const onDay = rows.filter((r) => r.tanggal === iso)
    const qqLewat = daily.some((d) => d.kind === 'qq' && d.tanggal === iso && d.data.kuantitas.some((n) => bejanaStatus(n.selisihMl) === 'lewat'))
    let status: CalendarDay['status'] = 'belum'
    if (onDay.some((r) => qqOf(r) === 'perhatian') || qqLewat) status = 'catatan'
    else if (onDay.some((r) => r.status === 'selesai') || daily.some((d) => d.kind === 'qq' && d.tanggal === iso)) status = 'sesuai'
    return { iso, label: hariSingkat(day), date: day.getDate(), status, isToday: sameDay(day, now) }
  })
}

export interface D15Sample {
  id: string
  tanggal: string
  nopol: string
  d15: number
  depot: number | null
  selisih: number | null
  ok: boolean | null
}

/**
 * Dashboard kualitas: tiga sampel D15 bongkaran terakhir per produk (bergulir,
 * bongkaran baru menggantikan sampel terlama).
 */
export function kualitasProduk(rows: ReportSummary[]) {
  return PRODUK_OPTIONS.map((produk) => {
    const samples: D15Sample[] = rows
      .filter((r) => r.produk === produk && r.d15 !== null && r.status !== 'draft')
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt)
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        tanggal: r.tanggal,
        nopol: r.nopol,
        d15: r.d15!,
        depot: r.d15Depot,
        selisih: r.d15Depot !== null ? Math.round((r.d15! - r.d15Depot) * 10000) / 10000 : null,
        ok: r.densityOk,
      }))
    const status: QQStatus = !samples.length ? 'belum' : samples.every((s) => s.ok !== false) ? 'sesuai' : 'perhatian'
    return { produk, samples, status }
  })
}

export interface NozzleTera {
  key: string
  nozzle: string
  produk: string
  tanggal: string
  shift: number
  selisihMl: number | null
  lewat: boolean
}

/** Dashboard kuantitas: hasil tera (bejana 20 L) terakhir tiap nozzle, dikelompokkan per produk. */
export function kuantitasNozzle(daily: DailyRecord[], nozzles: Nozzle[]) {
  const qq = daily.filter((d): d is QqRecord => d.kind === 'qq').sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const latest = new Map<string, NozzleTera>()
  for (const r of qq)
    for (const n of r.data.kuantitas) {
      const key = n.nozzleId || `${n.nozzle}|${n.produk}`
      if (latest.has(key)) continue
      latest.set(key, { key, nozzle: n.nozzle, produk: n.produk, tanggal: r.tanggal, shift: r.shift, selisihMl: parseAngka(n.selisihMl), lewat: bejanaStatus(n.selisihMl) === 'lewat' })
    }
  for (const nz of nozzles) if (!latest.has(nz.id)) latest.set(nz.id, { key: nz.id, nozzle: nz.nama, produk: nz.produk, tanggal: '', shift: 0, selisihMl: null, lewat: false })
  return PRODUK_OPTIONS.map((produk) => ({ produk, nozzles: [...latest.values()].filter((n) => n.produk === produk).sort((a, b) => a.nozzle.localeCompare(b.nozzle, 'id', { numeric: true })) })).filter((g) => g.nozzles.length)
}

/** Semua catatan satu tanggal untuk detail kalender. */
export function detailTanggal(iso: string, rows: ReportSummary[], daily: DailyRecord[]) {
  return {
    bongkaran: rows.filter((r) => r.tanggal === iso).sort((a, b) => a.jam.localeCompare(b.jam)),
    qq: daily.filter((d): d is QqRecord => d.kind === 'qq' && d.tanggal === iso).sort((a, b) => a.shift - b.shift),
    stok: daily.filter((d): d is StokRecord => d.kind === 'stok' && d.tanggal === iso).sort((a, b) => a.shift - b.shift),
  }
}


/** D15 bongkaran terakhir suatu produk (sampai tanggal tertentu) sebagai acuan uji harian. */
export function acuanD15(rows: ReportSummary[], produk: string, sampai?: string) {
  let best: ReportSummary | null = null
  for (const r of rows) {
    if (r.produk !== produk || r.d15 === null || r.status === 'draft') continue
    if (sampai && r.tanggal > sampai) continue
    if (!best || r.tanggal + r.jam > best.tanggal + best.jam) best = r
  }
  return best ? { d15: best.d15 as number, tanggal: best.tanggal } : null
}

export type Kaleng = ReportSummary & { kalengId: string; selisih: number | null }

/**
 * Kaleng sample per produk: 3 bongkaran terakhir yang sudah diuji density
 * (kaleng 1 = terbaru), plus tanggal plan kirim berikutnya untuk slot kosong.
 */
export function kalengSample(rows: ReportSummary[], plans: Plan[], used: Map<string, ReportSummary>, kode: (produk: string) => string) {
  return PRODUK_OPTIONS.map((produk) => {
    const cans: Kaleng[] = rows
      .filter((r) => r.produk === produk && r.d15 !== null && r.status !== 'draft')
      .sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam) || b.createdAt - a.createdAt)
      .slice(0, 3)
      .map((r, _, arr) => {
        const ymd = r.tanggal.slice(2).replace(/-/g, '')
        const sameDay = arr.filter((x) => x.tanggal === r.tanggal)
        const urut = sameDay.length > 1 ? `-${sameDay.length - sameDay.indexOf(r)}` : ''
        return {
          ...r,
          kalengId: `SPL-${kode(produk)}-${ymd}${urut}`,
          selisih: r.d15Depot !== null ? Math.round((r.d15! - r.d15Depot) * 10000) / 10000 : null,
        }
      })
    const status: QQStatus = !cans.length ? 'belum' : cans.every((c) => c.densityOk !== false) ? 'sesuai' : 'perhatian'
    const today = todayIso()
    const next = plans
      .filter((p) => p.tanggal >= today && p.los.some((lo) => lo.produk === produk && ['os', 'planned', 'delivery'].includes(loStatus(lo, used))))
      .map((p) => p.tanggal)
      .sort()[0]
    return { produk, cans, status, nextPlan: next ?? null }
  })
}
