/**
 * Uji takaran nozzle dengan bejana ukur 20 liter. Satu hasil = satu nozzle, satu opsi
 * (P = Preset, M = Manual), satu selisih (ml). Selisih di bawah -60 ml melebihi toleransi.
 */
import { BEJANA_LIMIT_ML, bejanaStatus } from '@/lib/daily'
import { formatSigned, parseAngka } from '@/lib/format'
import type { Photo } from '@/lib/sop'

export type OpsiTakar = 'P' | 'M'

export const OPSI_TAKAR: { value: OpsiTakar; label: string; desc: string }[] = [
  { value: 'P', label: 'P · Preset', desc: 'Dispenser diatur 20 L, berhenti otomatis' },
  { value: 'M', label: 'M · Manual', desc: 'Nozzle ditahan & dilepas petugas di 20 L' },
]
export const opsiLabel = (o: OpsiTakar) => (o === 'P' ? 'Preset' : 'Manual')

export const TOLERANSI_TAKAR_ML = BEJANA_LIMIT_ML

export type FotoTakarKey = 'dudukan' | 'hasil'
export const FOTO_TAKAR: { key: FotoTakarKey; label: string; hint: string }[] = [
  { key: 'dudukan', label: 'Dudukan bejana & water pass', hint: 'Bejana di dudukan, gelembung water pass di tengah (kondisi stabil)' },
  { key: 'hasil', label: 'Hasil pengukuran', hint: 'Skala leher bejana terbaca jelas setelah pengisian' },
]

export interface TakarData {
  nozzle: string
  produk: string
  opsi: OpsiTakar
  /** Selisih terhadap 20 L dalam ml; minus = kurang. */
  hasilMl: string
  jam: string
  petugas: string
  catatan: string
  foto: Record<FotoTakarKey, Photo[]>
}

export const takarStatus = (hasilMl: string) => bejanaStatus(hasilMl)

/** "-40 ml" */
export function formatMl(hasilMl: string) {
  const v = parseAngka(hasilMl)
  return v === null ? '-' : `${formatSigned(v, 0)} ml`
}

/** "Nozzle 3 Pertalite, Preset = -40 ml" */
export const ringkasTakar = (d: TakarData) => `Nozzle ${d.nozzle} ${d.produk}, ${opsiLabel(d.opsi)} = ${formatMl(d.hasilMl)}`
