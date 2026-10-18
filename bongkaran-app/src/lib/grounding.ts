/**
 * HSSE > Pengukuran Grounding SPBU: tahanan pentanahan (Ω) setiap titik. Titik ukur ditarik otomatis dari
 * data SPBU: tangki pendam (database tangki), dispenser & pulau pompa, fasilitas SPBU, dan area APAR.
 * Satu catatan per tanggal pengukuran (tabel bbm_grounding).
 */
import { FASILITAS, punyaFasilitas, labelTangki, type TangkiOps } from '@/lib/ops'
import type { Photo, Settings } from '@/lib/sop'

/** Batas tahanan pentanahan bawaan (Ω): ≤ 5 Ω memenuhi. */
export const BATAS_OHM = 5
/** Pengukuran ulang disarankan setiap 6 bulan. */
export const SELANG_BULAN = 6

export interface TitikGrounding {
  id: string
  kelompok: string
  area: string
}

export interface NilaiTitik {
  area: string
  kelompok: string
  /** Hasil ukur (Ω) sebagai teks isian; kosong = tidak diukur. */
  ohm: string
  ket: string
}

export interface GroundingData {
  titik: Record<string, NilaiTitik>
  batasOhm: number
  alat: string
  petugas: string
  /** Pelaksana / vendor pengukur (opsional). */
  pelaksana: string
  catatan: string
  foto: Photo[]
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Fasilitas bangunan/peralatan yang punya titik pentanahan. */
const FASILITAS_GROUNDING = ['genset', 'kantor', 'enduro', 'gudang', 'ruangBuh', 'mushola', 'toilet', 'ruangIstirahat']

/** Titik ukur otomatis dari data SPBU (database tangki, dispenser, fasilitas, area APAR). */
export function titikGrounding(s: Pick<Settings, 'dispensers' | 'fasilitas' | 'aparArea' | 'jumlahPulau'>, tanks: TangkiOps[]): TitikGrounding[] {
  const out: TitikGrounding[] = []
  const tambah = (kelompok: string, area: string, id = `${slug(kelompok)}-${slug(area)}`) => {
    if (!out.some((t) => t.id === id)) out.push({ id, kelompok, area })
  }
  for (const t of tanks) {
    tambah('Tangki pendam', labelTangki(t), `tangki-${slug(t.id)}`)
    tambah('Tangki pendam', `Pipa vent ${labelTangki(t)}`, `vent-${slug(t.id)}`)
  }
  tambah('Area bongkar', 'Titik bonding mobil tangki (fill point)')
  const dispensers = s.dispensers ?? []
  if (dispensers.length) for (const d of dispensers) tambah('Dispenser', `${d.nama}${d.pulau ? ` · Pulau ${d.pulau}` : ''}`, `dispenser-${slug(d.id)}`)
  else for (let i = 1; i <= Math.max(1, s.jumlahPulau || 0); i++) tambah('Dispenser', `Pulau pompa ${i}`)
  tambah('Kelistrikan', 'Panel listrik utama')
  tambah('Kelistrikan', 'Panel dispenser & tangki pendam')
  tambah('Penangkal petir', 'Penangkal petir (lightning arrester)')
  tambah('Penangkal petir', 'Kanopi & rangka kanopi')
  for (const f of FASILITAS.filter((x) => FASILITAS_GROUNDING.includes(x.key) && punyaFasilitas(s, x.key))) tambah('Fasilitas', f.label)
  for (const a of s.aparArea ?? []) if (!out.some((t) => t.area.toLowerCase() === a.toLowerCase())) tambah('Area SPBU', a)
  return out
}

export const nilaiOhm = (v: string) => {
  const n = Number(String(v).replace(',', '.'))
  return v.trim() && Number.isFinite(n) ? n : null
}
export type StatusTitik = 'baik' | 'buruk' | 'kosong'
export const statusTitik = (v: NilaiTitik | undefined, batas: number): StatusTitik => {
  const n = v ? nilaiOhm(v.ohm) : null
  return n === null ? 'kosong' : n <= batas ? 'baik' : 'buruk'
}

export function ringkasGrounding(d: GroundingData) {
  const st = Object.values(d.titik).map((v) => statusTitik(v, d.batasOhm))
  return { diukur: st.filter((x) => x !== 'kosong').length, baik: st.filter((x) => x === 'baik').length, buruk: st.filter((x) => x === 'buruk').length }
}
