/**
 * Volume tangki pendam dari ketinggian (mm), berdasarkan tabel kalibrasi tangki
 * (data/tankTables.json, dari file acuan TABEL TANGKI COCO KEDIRI). Nilai di
 * antara dua baris tabel dihitung dengan interpolasi linear.
 */
import data from '@/data/tankTables.json'
import { parseAngka } from '@/lib/format'

export interface Tank {
  id: string
  produk: string
  tankNo: string
  label: string
  customer: string | null
  tanggalKalibrasi: string | null
  catatan: string | null
  startMm: number
  stepMm: number
  maxMm: number
  capacity: number
  anomalyLevels: number[]
}

export const TANK_SPBU: string = data.spbu

const VOLUMES: Record<string, number[]> = Object.fromEntries(data.tanks.map((t) => [t.id, t.volumes]))

export const TANKS: Tank[] = data.tanks.map((t) => ({
  id: t.id,
  produk: t.produk,
  tankNo: String(t.tankNo),
  label: `Tangki ${t.tankNo} – ${t.produk}`,
  customer: t.customer ?? null,
  tanggalKalibrasi: t.tanggalKalibrasi ?? null,
  catatan: (t as { catatan?: string | null }).catatan ?? null,
  startMm: t.startMm,
  stepMm: t.stepMm,
  maxMm: t.maxMm,
  capacity: t.volumes[t.volumes.length - 1],
  anomalyLevels: t.anomalyLevels,
}))

export function getTank(id: string | null | undefined) {
  return TANKS.find((t) => t.id === id) ?? null
}

export function tankForProduk(produk: string | null | undefined) {
  if (!produk) return null
  const p = produk.toLowerCase()
  return TANKS.find((t) => t.produk.toLowerCase() === p) ?? null
}

export type VolumeResult = { volume: number; anomaly: boolean; error?: undefined } | { error: string; volume?: undefined; anomaly?: undefined }

/** Null bila ketinggian kosong. */
export function volumeFromLevel(tankId: string | null | undefined, level: string | number | null | undefined): VolumeResult | null {
  const mm = typeof level === 'number' ? level : parseAngka(String(level ?? ''))
  if (mm === null) return null
  const tank = getTank(tankId)
  if (!tank) return { error: 'Pilih tangki terlebih dahulu' }
  if (mm < tank.startMm || mm > tank.maxMm) return { error: `Di luar tabel kalibrasi (${tank.startMm}–${tank.maxMm} mm)` }
  const vols = VOLUMES[tank.id]
  const pos = (mm - tank.startMm) / tank.stepMm
  const i0 = Math.floor(pos)
  const i1 = Math.min(i0 + 1, vols.length - 1)
  const volume = vols[i0] + (vols[i1] - vols[i0]) * (pos - i0)
  // anomalyLevels = level di mana volume tabel justru turun dari baris sebelumnya.
  const anomaly = tank.anomalyLevels.some((l) => Math.abs(mm - l) < tank.stepMm)
  return { volume: Math.round(volume * 10) / 10, anomaly }
}
