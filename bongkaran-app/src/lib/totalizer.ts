/**
 * Operation > Totalizer: satu catatan per tanggal & shift (tabel bbm_totalizer), dua langkah per nozzle:
 * (1) totalisator manual/mekanik oleh security (angka + foto wajib bercap waktu), (2) totalisator digital
 * akhir shift oleh kepala shift. Awal digital = akhir digital shift sebelumnya (otomatis). Penjualan
 * nozzle = akhir − awal; penjualan manual (selisih manual antarshift) menjadi pembanding.
 * Dipakai juga untuk closing shift dan BA Totalisator stock opname.
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
  /** Foto totalisator manual (mekanik) saat awal / akhir shift (catatan lama). */
  fotoAwal?: Photo[]
  fotoAkhir?: Photo[]
  /** Totalisator manual (mekanik) akhir shift oleh security: angka, waktu submit, foto bercap waktu. */
  manual?: string
  manualAt?: string
  manualOleh?: string
  fotoManual?: Photo[]
  /** Penginput totalisator digital akhir (kepala shift). */
  akhirOleh?: string
}

export type LangkahTotalizer = 'awal' | 'akhir'
/** Langkah form: totalisator manual (security) lalu digital akhir shift (kepala shift). */
export type LangkahForm = 'manual' | 'digital'

export const manualTerkirim = (n: TotalizerNozzle | undefined) => !!n?.manualAt && parseAngka(n.manual ?? '') !== null

/** Catatan lama (sebelum submit per nozzle): angka yang terisi dianggap sudah terkirim. */
export const catatanLama = (r: TotalizerRecord | undefined) => !!r && !Object.values(r.data.nozzle).some((n) => n.awalAt || n.akhirAt)

/** Nozzle sudah disubmit pada langkah ini. */
export const nozzleTerkirim = (n: TotalizerNozzle | undefined, langkah: LangkahTotalizer, lama = false) =>
  !!n && (langkah === 'awal' ? !!n.awalAt || (lama && n.awal.trim() !== '') : !!n.akhirAt || (lama && n.akhir.trim() !== ''))

export interface TotalizerData {
  /** Per id nozzle (data utama nozzle). */
  nozzle: Record<string, TotalizerNozzle>
  /** Kepala shift (totalisator digital). */
  petugas: string
  /** Security (totalisator manual). */
  petugasManual?: string
  jamAwal: string
  jamAkhir: string
  catatan: string
}

export type TotalizerRecord = Catatan<TotalizerData>

export function prevShift(k: { tanggal: string; shift: Shift }): { tanggal: string; shift: Shift } {
  if (k.shift > 1) return { tanggal: k.tanggal, shift: (k.shift - 1) as Shift }
  return { tanggal: todayIso(addDays(new Date(`${k.tanggal}T00:00:00`), -1)), shift: 3 }
}

export function nextShift(k: { tanggal: string; shift: Shift }): { tanggal: string; shift: Shift } {
  if (k.shift < 3) return { tanggal: k.tanggal, shift: (k.shift + 1) as Shift }
  return { tanggal: todayIso(addDays(new Date(`${k.tanggal}T00:00:00`), 1)), shift: 1 }
}

/** Penjualan menurut totalisator manual: manual shift ini − manual shift sebelumnya (liter). */
export function jualManual(prev: TotalizerNozzle | undefined, n: TotalizerNozzle | undefined) {
  const a = parseAngka(prev?.manual ?? '')
  const b = parseAngka(n?.manual ?? '')
  return a === null || b === null ? null : b - a
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

/** Liter pump test per kunci "tanggal|shift|produk" (lihat `pumpTestPerShift` di lib/pumptest). */
export type PumpTestShift = Map<string, number>
export const kunciPumpTest = (tanggal: string, shift: number, produk: string) => `${tanggal}|${shift}|${produk}`

/**
 * Penjualan per produk dari satu atau beberapa catatan totalizer. `kotor` = selisih totalisator (akhir − awal);
 * `liter` = penjualan bersih = kotor − pump test shift itu (BBM uji dikembalikan ke tangki, bukan penjualan).
 */
export function jualPerProduk(recs: TotalizerRecord[], pumpTest?: PumpTestShift) {
  const kotor = new Map<string, number>()
  const pt = new Map<string, number>()
  for (const r of recs) {
    const ada = new Set<string>()
    for (const x of Object.values(r.data.nozzle)) {
      const j = jualNozzle(x)
      if (j === null) continue
      kotor.set(x.produk, (kotor.get(x.produk) ?? 0) + j)
      ada.add(x.produk)
    }
    // Pump test dikurangkan hanya untuk produk yang punya angka totalisator di shift itu.
    if (pumpTest) for (const p of ada) pt.set(p, (pt.get(p) ?? 0) + (pumpTest.get(kunciPumpTest(r.tanggal, r.shift, p)) ?? 0))
  }
  const urut = [...PRODUK_OPTIONS, ...[...kotor.keys()].filter((p) => !PRODUK_OPTIONS.includes(p))]
  return urut.filter((p) => kotor.has(p)).map((produk) => {
    const k = kotor.get(produk)!
    const u = pt.get(produk) ?? 0
    return { produk, kotor: k, pumpTest: u, liter: k - u }
  })
}

/** Nozzle dikelompokkan per pulau pompa & dispenser (urutan data utama). */
export function nozzlePerDispenser(nozzles: Nozzle[], dispensers: Dispenser[]) {
  const grup = dispensers.map((d) => ({ judul: `${d.nama}${d.pulau ? ` · ${d.pulau}` : ''}`, nozzles: nozzles.filter((n) => n.dispenserId === d.id) }))
  const lain = nozzles.filter((n) => !dispensers.some((d) => d.id === n.dispenserId))
  return [...grup, ...(lain.length ? [{ judul: 'Tanpa dispenser', nozzles: lain }] : [])].filter((g) => g.nozzles.length)
}
