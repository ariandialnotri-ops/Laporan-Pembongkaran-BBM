/**
 * Bongkaran paralel: satu mobil tangki (MT) membawa beberapa produk, sehingga ada beberapa laporan bongkaran
 * (satu per produk/tangki) yang dikerjakan bersamaan. Laporan-laporan itu memakai `data.grupMt` yang sama.
 * Data administrasi MT cukup diisi sekali di salah satu laporan dan otomatis tersalin ke laporan lain
 * yang masih draft; data per produk (LO, tangki, ATG, deepstick, density, dst.) tetap terpisah.
 */
import { genId } from '@/lib/image'
import type { Photos, Report, ReportData } from '@/lib/sop'

/** Isian administrasi MT yang sama untuk semua produk dalam satu kedatangan MT. */
export const FIELD_BERSAMA = [
  'nopol',
  'namaDriver',
  'perusahaanPengangkut',
  'soldTo',
  'tanggalDatang',
  'jamDatang',
  'tanggalKeluar',
  'jamKeluar',
  'safetyApar',
  'safetyArde',
  'safetyAtribut',
] as const satisfies readonly (keyof ReportData)[]

/** Slot foto administrasi MT: foto MT, dokumen LO, buku tera, kelengkapan safety. */
export const SLOT_BERSAMA = ['mt_depan', 'dok_lo', 'buku_tera', 'safety'] as const

/** Ringkasan untuk pengguna: bagian form yang ikut tersalin. */
export const KETERANGAN_BERSAMA = 'Foto & nopol MT, data driver/pengangkut/Sold To, jam datang & keluar depot, foto dokumen LO, foto buku tera, dan kelengkapan safety'

export const grupMtBaru = () => genId('g')

type Bersama = { data: Partial<ReportData>; photos: Photos }

export function dataBersama(r: Report): Bersama {
  const data: Partial<ReportData> = {}
  for (const k of FIELD_BERSAMA) (data as Record<string, unknown>)[k] = r.data[k]
  const photos: Photos = {}
  for (const s of SLOT_BERSAMA) photos[s] = r.photos[s] ?? []
  return { data, photos }
}

/** Kunci pembanding: berubah bila isian atau foto administrasi berubah (foto dibandingkan per id). */
export function kunciBersama(r: Report) {
  const b = dataBersama(r)
  return JSON.stringify([b.data, SLOT_BERSAMA.map((s) => b.photos[s].map((p) => p.id))])
}

/** Salin data administrasi `sumber` ke `target` (laporan lain dalam grup yang sama). */
export function terapkanBersama(target: Report, sumber: Report): Report {
  const b = dataBersama(sumber)
  return {
    ...target,
    updatedAt: Date.now(),
    data: { ...target.data, ...b.data, grupMt: sumber.data.grupMt },
    photos: { ...target.photos, ...b.photos },
  }
}
