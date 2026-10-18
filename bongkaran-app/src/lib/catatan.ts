/**
 * Catatan per tanggal & shift (atau per bulan) yang disimpan di tabel tersendiri dengan bentuk sama:
 * totalizer digital (bbm_totalizer), closing shift (bbm_closing), stock opname bulanan (bbm_so),
 * pengukuran grounding (bbm_grounding, per tanggal), dan jadwal shift personil (bbm_jadwal, per bulan).
 */
export type JenisCatatan = 'totalizer' | 'closing' | 'so' | 'grounding' | 'jadwal'

export const TABEL_CATATAN: Record<JenisCatatan, string> = { totalizer: 'bbm_totalizer', closing: 'bbm_closing', so: 'bbm_so', grounding: 'bbm_grounding', jadwal: 'bbm_jadwal' }

export interface Catatan<T> {
  /** `${tanggal}_${shift}`; stock opname: `YYYY-MM`. */
  id: string
  tanggal: string
  /** 1–3; stock opname: 0. */
  shift: number
  data: T
  createdAt: number
  updatedAt: number
  createdBy: string | null
}

export const idShift = (tanggal: string, shift: number) => `${tanggal}_${shift}`
