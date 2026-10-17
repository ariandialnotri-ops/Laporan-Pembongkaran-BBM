/**
 * Catatan per tanggal & shift (atau per bulan) yang disimpan di tabel tersendiri dengan bentuk sama:
 * totalizer digital (bbm_totalizer), closing shift (bbm_closing), dan stock opname bulanan (bbm_so).
 */
export type JenisCatatan = 'totalizer' | 'closing' | 'so'

export const TABEL_CATATAN: Record<JenisCatatan, string> = { totalizer: 'bbm_totalizer', closing: 'bbm_closing', so: 'bbm_so' }

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
