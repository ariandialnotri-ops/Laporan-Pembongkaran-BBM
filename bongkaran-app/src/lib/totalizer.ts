/**
 * Operation > Totalizer: totalisator digital setiap nozzle di awal dan akhir shift. Satu catatan per
 * tanggal & shift (tabel bbm_totalizer). Penjualan nozzle = akhir − awal; awal shift diisi otomatis
 * dari akhir shift sebelumnya. Dipakai juga untuk closing shift dan BA Totalisator stock opname.
 */
import { parseAngka } from '@/lib/format'
import type { Catatan } from '@/lib/catatan'
import { addDays, todayIso } from '@/lib/date'
import type { Shift } from '@/lib/shift'
import { PRODUK_OPTIONS, type Dispenser, type Nozzle, type Photo } from '@/lib/sop'

export interface TotalizerNozzle {
  nama: string
  produk: string
  awal: string
  akhir: string
  /** Waktu submit per nozzle (ISO); diisi saat tombol Submit nozzle ditekan. */
  awalAt?: string
  akhirAt?: string
  /** Foto totalisator manual (mekanik) saat awal / akhir shift. */
  fotoAwal?: Photo[]
  fotoAkhir?: Photo[]
}

export type LangkahTotalizer = 'awal' | 'akhir'

/** Catatan lama (sebelum submit per nozzle): angka yang terisi dianggap sudah terkirim. */
export const catatanLama = (r: TotalizerRecord | undefined) => !!r && !Object.values(r.data.nozzle).some((n) => n.awalAt || n.akhirAt)

/** Nozzle sudah disubmit pada langkah ini. */
export const nozzleTerkirim = (n: TotalizerNozzle | undefined, langkah: LangkahTotalizer, lama = false) =>
  !!n && (langkah === 'awal' ? !!n.awalAt || (lama && n.awal.trim() !== '') : !!n.akhirAt || (lama && n.akhir.trim() !== ''))

export interface TotalizerData {
  /** Per id nozzle (data utama nozzle). */
  nozzle: Record<string, TotalizerNozzle>
  petugas: string
  jamAwal: string
  jamAkhir: string
  catatan: string
}

export type TotalizerRecord = Catatan<TotalizerData>

export function prevShift(k: { tanggal: string; shift: Shift }): { tanggal: string; shift: Shift } {
  if (k.shift > 1) return { tanggal: k.tanggal, shift: (k.shift - 1) as Shift }
  return { tanggal: todayIso(addDays(new Date(`${k.tanggal}T00:00:00`), -1)), shift: 3 }
}

/** Penjualan satu nozzle (liter); null bila awal/akhir belum diisi. */
export function jualNozzle(n: Pick<TotalizerNozzle, 'awal' | 'akhir'> | undefined) {
  const a = parseAngka(n?.awal ?? '')
  const b = parseAngka(n?.akhir ?? '')
  return a === null || b === null ? null : b - a
}

/** Semua nozzle terisi awal & akhir. */
export const totalizerLengkap = (r: TotalizerRecord | undefined, nozzles: Nozzle[]) => !!r && nozzles.length > 0 && nozzles.every((n) => jualNozzle(r.data.nozzle[n.id]) !== null)
/** Baru awal shift yang terisi. */
export const totalizerAwalSaja = (r: TotalizerRecord | undefined, nozzles: Nozzle[]) => !!r && !totalizerLengkap(r, nozzles) && nozzles.some((n) => parseAngka(r.data.nozzle[n.id]?.awal ?? '') !== null)

/** Penjualan (liter) per produk dari satu atau beberapa catatan totalizer. */
export function jualPerProduk(recs: TotalizerRecord[]) {
  const m = new Map<string, number>()
  for (const r of recs) for (const x of Object.values(r.data.nozzle)) {
    const j = jualNozzle(x)
    if (j !== null) m.set(x.produk, (m.get(x.produk) ?? 0) + j)
  }
  const urut = [...PRODUK_OPTIONS, ...[...m.keys()].filter((p) => !PRODUK_OPTIONS.includes(p))]
  return urut.filter((p) => m.has(p)).map((produk) => ({ produk, liter: m.get(produk)! }))
}

/** Nozzle dikelompokkan per pulau pompa & dispenser (urutan data utama). */
export function nozzlePerDispenser(nozzles: Nozzle[], dispensers: Dispenser[]) {
  const grup = dispensers.map((d) => ({ judul: `${d.nama}${d.pulau ? ` · ${d.pulau}` : ''}`, nozzles: nozzles.filter((n) => n.dispenserId === d.id) }))
  const lain = nozzles.filter((n) => !dispensers.some((d) => d.id === n.dispenserId))
  return [...grup, ...(lain.length ? [{ judul: 'Tanpa dispenser', nozzles: lain }] : [])].filter((g) => g.nozzles.length)
}
