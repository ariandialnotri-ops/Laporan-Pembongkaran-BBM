import { cariProdukByName, TOLERANSI_BONGKAR_PERSEN, TOLERANSI_TERA_PERSEN, type QQStatus } from '@/data/mock'
import type { Bongkaran } from '@/lib/types'

/** Selisih DO vs realisasi in percent of DO. */
export function persenBongkar(vDo: number, vReal: number) {
  return ((vReal - vDo) / vDo) * 100
}

/** Selisih bejana vs meter pompa in percent of the meter reading. */
export function persenTera(bejana: number, awal: number, akhir: number) {
  const meter = akhir - awal
  return ((bejana - meter) / meter) * 100
}

/**
 * Final Q&Q verdict for a finished record. Any single check outside its
 * limit marks the unloading "perhatian" and names the failing check.
 */
export function nilaiQQ(b: Pick<Bongkaran, 'produk' | 'volume_do' | 'volume_realisasi' | 'density_koreksi' | 'tera_bejana' | 'meter_awal' | 'meter_akhir'>): {
  status: QQStatus
  catatan: string | null
} {
  const masalah: string[] = []
  if (Math.abs(persenBongkar(b.volume_do, b.volume_realisasi)) > TOLERANSI_BONGKAR_PERSEN) masalah.push('Selisih volume')
  const produk = cariProdukByName(b.produk)
  if (b.density_koreksi === null) masalah.push('Density belum diisi')
  else if (b.density_koreksi < produk.densityMin || b.density_koreksi > produk.densityMax) masalah.push('Cek density')
  if (b.tera_bejana === null || b.meter_awal === null || b.meter_akhir === null || b.meter_akhir <= b.meter_awal) {
    masalah.push('Tera belum lengkap')
  } else if (Math.abs(persenTera(b.tera_bejana, b.meter_awal, b.meter_akhir)) > TOLERANSI_TERA_PERSEN) {
    masalah.push('Tera di luar toleransi')
  }
  return masalah.length === 0 ? { status: 'sesuai', catatan: null } : { status: 'perhatian', catatan: masalah.join(', ') }
}

export function labelQQ(b: Pick<Bongkaran, 'qq_status' | 'qq_catatan' | 'tahap'>) {
  if (b.qq_status === 'sesuai') return 'Q&Q Sesuai'
  if (b.qq_status === 'perhatian') return b.qq_catatan ?? 'Perlu Cek'
  return b.tahap === 'quality' ? 'Belum Quantity' : 'Belum Q&Q'
}
