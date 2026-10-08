/**
 * Plan pengiriman: status SO/LO dan penyesuaian data plan lama.
 */
import { DEFAULT_RULES, type LoStatus, type Plan, type PlanLo, type ReportSummary } from '@/lib/sop'

/** Status tampilan: "proses" = LO belum diterbitkan depot. */
export type LoDisplayStatus = LoStatus | 'proses'

export const LO_STATUS: { key: LoDisplayStatus; label: string; desc: string; tone: 'neutral' | 'primary' | 'info' | 'success' | 'error' | 'cyan' }[] = [
  { key: 'proses', label: 'Proses', desc: 'Menunggu approval SO & LO dari depot', tone: 'neutral' },
  { key: 'os', label: 'OS', desc: 'LO outstanding dari depot', tone: 'info' },
  { key: 'planned', label: 'Planned', desc: 'Menunggu antrian MT pengantaran', tone: 'cyan' },
  { key: 'delivery', label: 'On Delivery', desc: 'Dalam pengisian atau pengiriman', tone: 'primary' },
  { key: 'alih', label: 'Alih Supply', desc: 'Dipindahkan ke terminal/depot lain', tone: 'cyan' },
  { key: 'deleted', label: 'Deleted', desc: 'Dihapus oleh Supply Chain atau depot', tone: 'error' },
  { key: 'delivered', label: 'Delivered', desc: 'Sudah sampai, dalam proses bongkar di SPBU', tone: 'primary' },
  { key: 'closed', label: 'Closed', desc: 'Bongkar & administrasi selesai', tone: 'success' },
]

/** Status yang dapat dipilih manual; Delivered & Closed mengikuti data bongkaran. */
/** Satu LO maksimal 8.000 liter (satu PB); permintaan di atas itu dipecah menjadi beberapa LO. */
export const LO_MAX_LITER = 8000

/** Pecah volume permintaan menjadi volume per LO: tiap 8.000 L = 1 LO, sisa menjadi LO terakhir. */
export function pecahVolume(volume: number): number[] {
  if (!(volume > 0)) return []
  const n = Math.ceil(volume / LO_MAX_LITER)
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? LO_MAX_LITER : volume - LO_MAX_LITER * (n - 1)))
}

export const LO_MANUAL_STATUS: LoStatus[] = ['os', 'planned', 'delivery', 'alih', 'deleted']

/** Pilihan shift permintaan pengiriman (hanya shift 1 dan 2). */
export const SHIFT_PERMINTAAN = [
  { value: '1' as const, label: 'Shift 1' },
  { value: '2' as const, label: 'Shift 2' },
]

export const loStatusMeta = (k: LoDisplayStatus) => LO_STATUS.find((s) => s.key === k)!

/**
 * Status efektif LO: Delivered/Closed otomatis dari bongkaran yang memakai
 * LO itu, Proses bila nomor LO belum ada.
 */
export function loStatus(lo: PlanLo, used: Map<string, ReportSummary>): LoDisplayStatus {
  if (lo.status === 'deleted') return 'deleted'
  const r = used.get(lo.id)
  if (r) return r.status === 'draft' ? 'delivered' : 'closed'
  if (!lo.noLO.trim()) return 'proses'
  return lo.status
}

/** LO yang boleh dipilih saat bongkar. */
export function loPickable(lo: PlanLo, used: Map<string, ReportSummary>) {
  return !!lo.noLO.trim() && !['deleted', 'closed', 'delivered', 'proses'].includes(loStatus(lo, used))
}

export function planSupply(plan: Plan, lo?: PlanLo) {
  return lo?.supplyPoint || plan.supplyPoint
}

/** Plan lama (satu produk per SO, jumlah DO) ke bentuk baru. */
export function normalizePlan(p: Partial<Plan> & { id: string; los?: Partial<PlanLo>[] }, literPerDO = DEFAULT_RULES.literPerDO): Plan {
  return {
    id: p.id,
    createdAt: p.createdAt ?? Date.now(),
    tanggal: p.tanggal ?? '',
    ms2Tanggal: p.ms2Tanggal ?? '',
    ms2Jam: p.ms2Jam ?? '',
    ms2Shift: p.ms2Shift ?? '',
    poSap: p.poSap ?? '',
    shipTo: p.shipTo || p.soldTo || '',
    supplyPoint: p.supplyPoint ?? '',
    noSO: p.noSO ?? '',
    produk: p.produk ?? '',
    soldTo: p.soldTo ?? '',
    los: (p.los ?? []).map((lo) => ({
      id: lo.id ?? '',
      noLO: lo.noLO ?? '',
      produk: lo.produk || p.produk || '',
      volume: lo.volume ?? (lo.jumlahDO ? lo.jumlahDO * literPerDO : 0),
      status: lo.status ?? 'os',
      segel: lo.segel ?? [],
      shift: lo.shift ?? p.ms2Shift ?? '',
      supplyPoint: lo.supplyPoint,
      noLOLama: lo.noLOLama,
      supplyPointLama: lo.supplyPointLama,
      jumlahDO: lo.jumlahDO,
    })),
  }
}

/** Jam pengingat harian membuat plan pengiriman untuk besok. */
export const JAM_PENGINGAT_PLAN = 6

/** Tanggal besok (ISO) bila sudah lewat 06:00 dan plan untuk besok belum dibuat; selain itu null. */
export function planBesokKurang(plans: Plan[], now = new Date()) {
  if (now.getHours() < JAM_PENGINGAT_PLAN) return null
  const b = new Date(now)
  b.setDate(b.getDate() + 1)
  const besok = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`
  const ada = plans.some((p) => p.tanggal === besok && p.los.some((lo) => lo.status !== 'deleted'))
  return ada ? null : besok
}
