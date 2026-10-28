/**
 * Database tangki pendam per SPBU: volume (L) dari ketinggian (mm) berdasarkan tabel
 * kalibrasi tangki. Nilai di antara dua baris tabel dihitung dengan interpolasi linear.
 * Daftar tangki SPBU aktif dipasang lewat setTanks() saat data SPBU dimuat.
 * data/tankTables.json (TABEL TANGKI COCO KEDIRI) dipakai untuk mode lokal.
 */
import data from '@/data/tankTables.json'
import { parseAngka } from '@/lib/format'

/** Tabel kalibrasi: interval tetap {startMm, stepMm, volumes} atau titik bebas {levels, volumes}. */
export interface TankTabel {
  startMm?: number
  stepMm?: number
  levels?: number[]
  volumes: number[]
  /** Ketinggian yang ditandai janggal (koreksi data asli). */
  anomali?: number[]
}

/** Tangki seperti tersimpan di database SPBU. */
export interface TankDef {
  id: string
  produk: string
  tankNo: string
  tanggalKalibrasi: string | null
  catatan: string | null
  tabel: TankTabel
  urut: number
}

export interface Tank {
  id: string
  produk: string
  tankNo: string
  label: string
  tanggalKalibrasi: string | null
  catatan: string | null
  startMm: number
  maxMm: number
  /** Jarak antarbaris tabel terkecil (mm). */
  stepMm: number
  capacity: number
  rows: number
  anomalyLevels: number[]
  levels: number[]
  volumes: number[]
}

/** "Tangki 3"; nomor non-angka (mis. "PERTADEX 3 KL") ditampilkan apa adanya. */
export const tankName = (no: string | number) => (/^\d+$/.test(String(no)) ? `Tangki ${no}` : String(no))

export function levelsOf(t: TankTabel) {
  return t.levels ?? t.volumes.map((_, i) => (t.startMm ?? 0) + i * (t.stepMm ?? 1))
}

export function buatTank(d: TankDef): Tank {
  const levels = levelsOf(d.tabel)
  const volumes = d.tabel.volumes
  let step = Infinity
  const turun: number[] = []
  for (let i = 1; i < levels.length; i++) {
    step = Math.min(step, levels[i] - levels[i - 1])
    if (volumes[i] < volumes[i - 1]) turun.push(levels[i])
  }
  return {
    id: d.id,
    produk: d.produk,
    tankNo: d.tankNo,
    label: `${tankName(d.tankNo)} (${d.produk})`,
    tanggalKalibrasi: d.tanggalKalibrasi,
    catatan: d.catatan,
    startMm: levels[0] ?? 0,
    maxMm: levels[levels.length - 1] ?? 0,
    stepMm: Number.isFinite(step) ? step : 1,
    capacity: volumes.length ? Math.max(...volumes) : 0,
    rows: levels.length,
    anomalyLevels: [...new Set([...(d.tabel.anomali ?? []), ...turun])].sort((a, b) => a - b),
    levels,
    volumes,
  }
}

/** Tangki COCO Kediri bawaan aplikasi (mode lokal). */
export const TANK_BAWAAN: TankDef[] = data.tanks.map((t, i) => ({
  id: t.id,
  produk: t.produk,
  tankNo: String(t.tankNo),
  tanggalKalibrasi: t.tanggalKalibrasi && t.tanggalKalibrasi !== '-' ? t.tanggalKalibrasi : null,
  catatan: (t as { catatan?: string | null }).catatan ?? null,
  tabel: { startMm: t.startMm, stepMm: t.stepMm, volumes: t.volumes, ...(t.anomalyLevels.length ? { anomali: t.anomalyLevels } : {}) },
  urut: i,
}))

/** Tangki SPBU aktif. Diganti setTanks(); modul pengimpor ikut melihat nilai terbaru. */
export let TANKS: Tank[] = []

export function urutTangki(defs: TankDef[]) {
  return [...defs].sort((a, b) => a.urut - b.urut || a.tankNo.localeCompare(b.tankNo, 'id', { numeric: true }))
}

export function setTanks(defs: TankDef[]) {
  TANKS = urutTangki(defs).map(buatTank)
}

export function getTank(id: string | null | undefined) {
  return TANKS.find((t) => t.id === id) ?? null
}

export function tankForProduk(produk: string | null | undefined) {
  if (!produk) return null
  const p = produk.toLowerCase()
  return TANKS.find((t) => t.produk.toLowerCase() === p) ?? null
}

export type VolumeResult = { volume: number; anomaly: boolean; error?: undefined } | { error: string; volume?: undefined; anomaly?: undefined }

/** Volume dari ketinggian pada satu tangki (interpolasi linear antarbaris tabel). */
export function volumeTank(tank: Tank, mm: number): VolumeResult {
  if (mm < tank.startMm || mm > tank.maxMm) return { error: `Di luar tabel kalibrasi (${tank.startMm}–${tank.maxMm} mm)` }
  const { levels, volumes } = tank
  let lo = 0
  let hi = levels.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (levels[mid] <= mm) lo = mid
    else hi = mid
  }
  const span = levels[hi] - levels[lo]
  const f = span > 0 ? Math.min(1, Math.max(0, (mm - levels[lo]) / span)) : 0
  const volume = volumes[lo] + (volumes[hi] - volumes[lo]) * f
  const jarak = Math.max(span, tank.stepMm)
  const anomaly = tank.anomalyLevels.some((l) => Math.abs(mm - l) < jarak)
  return { volume: Math.round(volume * 10) / 10, anomaly }
}

/** Null bila ketinggian kosong. */
export function volumeFromLevel(tankId: string | null | undefined, level: string | number | null | undefined): VolumeResult | null {
  const mm = typeof level === 'number' ? level : parseAngka(String(level ?? ''))
  if (mm === null) return null
  const tank = getTank(tankId)
  if (!tank) return { error: 'Pilih tangki terlebih dahulu' }
  return volumeTank(tank, mm)
}

export type HasilTempel = { ok: true; tabel: TankTabel; baris: number; diabaikan: number } | { ok: false; error: string }

/** Kolom satu baris: tab / titik koma (Excel), spasi, atau koma bila CSV tanpa spasi. */
function kolom(baris: string) {
  if (/[\t;]/.test(baris)) return baris.split(/[\t;]/)
  const spasi = baris.trim().split(/\s+/)
  return spasi.length === 1 && baris.includes(',') && /^[\d.,\s-]+$/.test(baris) && baris.split(',').length === 2 && !/,\d{1,2}$/.test(baris.trim()) ? baris.split(',') : spasi
}

/**
 * Baca tabel kalibrasi yang ditempel dari Excel/CSV: tiap baris berisi pasangan tinggi & volume
 * (boleh beberapa pasangan berdampingan). Baris judul diabaikan. Tinggi cm dikonversi ke mm.
 */
export function bacaTabelKalibrasi(teks: string, satuan: 'mm' | 'cm'): HasilTempel {
  const titik = new Map<number, number>()
  let diabaikan = 0
  for (const baris of teks.split(/\r?\n/)) {
    if (!baris.trim()) continue
    const angka = kolom(baris)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseAngka(s))
    if (angka.length < 2 || angka.length % 2 !== 0 || angka.some((n) => n === null)) {
      diabaikan++
      continue
    }
    for (let i = 0; i < angka.length; i += 2) titik.set(Math.round(angka[i]! * (satuan === 'cm' ? 10 : 1) * 1000) / 1000, angka[i + 1]!)
  }
  const urut = [...titik.entries()].sort((a, b) => a[0] - b[0])
  if (urut.length < 2) return { ok: false, error: 'Tabel belum terbaca. Tempel minimal 2 baris berisi tinggi dan volume.' }
  if (urut.some(([t, v]) => t < 0 || v < 0)) return { ok: false, error: 'Tinggi dan volume tidak boleh negatif.' }
  const levels = urut.map(([t]) => t)
  const volumes = urut.map(([, v]) => v)
  const step = levels[1] - levels[0]
  const tetap = levels.every((l, i) => Math.abs(l - (levels[0] + i * step)) < 1e-6)
  return { ok: true, tabel: tetap ? { startMm: levels[0], stepMm: step, volumes } : { levels, volumes }, baris: urut.length, diabaikan }
}
