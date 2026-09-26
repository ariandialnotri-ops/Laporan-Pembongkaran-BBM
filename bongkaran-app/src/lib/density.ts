/**
 * Kalkulator Density at 15°C.
 *
 * Sumber utama: Tabel ASTM-IP 53 "Density Reduction to 15°C" dari file acuan
 * (data/table53.json). Nilai di antara baris/kolom dihitung dengan interpolasi
 * linear (bilinear), sama seperti cara membaca tabel cetak.
 *
 * Tabel acuan mencakup densitas observasi 0,690–0,909 (lihat TABLE53_COVERAGE).
 * Di luar cakupan itu (jarang terjadi) dipakai rumus standar ASTM D1250 /
 * API MPMS 11.1 Tabel 53B sebagai cadangan, dan hasilnya diberi label metode.
 */
import table from '@/data/table53.json'
import { parseAngka } from '@/lib/format'

const EPS = 1e-9
const DENSITIES: number[] = table.densities
const TEMPS: number[] = table.temps
const VALUES: (number | null)[][] = table.values

export type DensityMethod = 'table' | 'formula'
export type Density15 = { value: number; method: DensityMethod }

export const METHOD_LABEL: Record<DensityMethod, string> = {
  table: 'Tabel ASTM 53 (acuan)',
  formula: 'Rumus ASTM 53B (di luar cakupan tabel)',
}

export const TABLE53_COVERAGE = '0,700–0,879 (suhu 0–50°C), 0,690–0,699 (15–50°C), dan 0,880–0,909 (25–50°C)'

export type Table53Correction = { sheet: string; cell: string; asli: number; koreksi: number; alasan: string }
/** Sel file acuan yang dikoreksi karena salah ketik (nilai asli & koreksi ada di table53.json). */
export const TABLE53_CORRECTIONS: Table53Correction[] = table.koreksi

/** Terima input g/mL ("0,745") maupun kg/m³ ("745"). */
export function normalizeDensity(input: string | number | null | undefined): number | null {
  const n = typeof input === 'number' ? input : parseAngka(String(input ?? ''))
  if (n === null || n <= 0) return null
  return n > 2 ? n / 1000 : n
}

function bracket(arr: number[], x: number, maxGap: number): [number, number] | null {
  for (let i = 0; i < arr.length; i++) {
    if (Math.abs(arr[i] - x) < EPS) return [i, i]
    if (i < arr.length - 1 && arr[i] < x && x < arr[i + 1]) {
      return arr[i + 1] - arr[i] <= maxGap + EPS ? [i, i + 1] : null
    }
  }
  return null
}

function fromTable(d: number, t: number): number | null {
  const di = bracket(DENSITIES, d, 0.001)
  const ti = bracket(TEMPS, t, 0.5)
  if (!di || !ti) return null
  const c00 = VALUES[ti[0]][di[0]]
  const c01 = VALUES[ti[0]][di[1]]
  const c10 = VALUES[ti[1]][di[0]]
  const c11 = VALUES[ti[1]][di[1]]
  if (c00 === null || c01 === null || c10 === null || c11 === null) return null
  const fd = di[0] === di[1] ? 0 : (d - DENSITIES[di[0]]) / (DENSITIES[di[1]] - DENSITIES[di[0]])
  const ft = ti[0] === ti[1] ? 0 : (t - TEMPS[ti[0]]) / (TEMPS[ti[1]] - TEMPS[ti[0]])
  const top = c00 + (c01 - c00) * fd
  const bottom = c10 + (c11 - c10) * fd
  return top + (bottom - top) * ft
}

/** ASTM D1250-80 Tabel 53B (generalized products), densitas dalam kg/m³. */
function alpha53B(rho15: number) {
  if (rho15 < 770.5) return 346.4228 / rho15 ** 2 + 0.4388 / rho15
  if (rho15 < 787.5) return -0.00336312 + 2680.3206 / rho15 ** 2
  if (rho15 < 838.5) return 594.5418 / rho15 ** 2
  return 186.9696 / rho15 ** 2 + 0.4862 / rho15
}

function fromFormula53B(d: number, t: number): number | null {
  const rhoObs = d * 1000
  if (rhoObs < 610 || rhoObs > 1075 || t < -18 || t > 95) return null
  let rho15 = rhoObs
  for (let i = 0; i < 50; i++) {
    const a = alpha53B(rho15)
    const dt = t - 15
    const next = rhoObs / Math.exp(-a * dt * (1 + 0.8 * a * dt))
    const done = Math.abs(next - rho15) < 1e-7
    rho15 = next
    if (done) break
  }
  return rho15 / 1000
}

export function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

/** Density at 15°C dari density observasi & suhu. Null bila input tidak valid. */
export function density15(obs: string | number | null | undefined, suhu: string | number | null | undefined): Density15 | null {
  const d = normalizeDensity(obs)
  const t = typeof suhu === 'number' ? suhu : parseAngka(String(suhu ?? ''))
  if (d === null || t === null) return null
  const tableValue = fromTable(d, t)
  if (tableValue !== null) return { value: round4(tableValue), method: 'table' }
  const formulaValue = fromFormula53B(d, t)
  if (formulaValue !== null) return { value: round4(formulaValue), method: 'formula' }
  return null
}
