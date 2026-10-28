/**
 * Plan pengiriman: status SO/LO dan penyesuaian data plan lama.
 */
import { formatTanggalIso } from '@/lib/date'
import { DEFAULT_RULES, sudahClosing, type JejakPlan, type LoStatus, type Plan, type PlanLo, type ReportSummary } from '@/lib/sop'

/** Status tampilan: "proses" = LO belum diterbitkan depot. */
export type LoDisplayStatus = LoStatus | 'proses'

export const LO_STATUS: { key: LoDisplayStatus; label: string; desc: string; tone: 'neutral' | 'primary' | 'info' | 'success' | 'error' | 'cyan' }[] = [
  { key: 'proses', label: 'Proses', desc: 'Menunggu approval SO & LO dari depot', tone: 'neutral' },
  { key: 'os', label: 'OS', desc: 'LO outstanding dari depot', tone: 'info' },
  { key: 'planned', label: 'Planned', desc: 'Menunggu antrian MT pengantaran', tone: 'cyan' },
  { key: 'delivery', label: 'On Delivery', desc: 'Dalam pengisian atau pengiriman', tone: 'primary' },
  { key: 'alih', label: 'Alih Supply', desc: 'Dipindahkan ke terminal/depot lain', tone: 'cyan' },
  { key: 'deleted', label: 'Deleted', desc: 'Dihapus oleh Supply Chain atau depot', tone: 'error' },
  { key: 'delivered', label: 'Delivered', desc: 'Sudah sampai: bongkar berjalan atau BA menunggu tanda tangan pengawas & ABH', tone: 'primary' },
  { key: 'closed', label: 'Closed', desc: 'Bongkar selesai dan BA ditandatangani pengawas & ABH', tone: 'success' },
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

/** Pilihan shift permintaan pengiriman (MS2). */
export const SHIFT_PERMINTAAN = [
  { value: '1' as const, label: 'Shift 1' },
  { value: '2' as const, label: 'Shift 2' },
  { value: '3' as const, label: 'Shift 3' },
]

export const loStatusMeta = (k: LoDisplayStatus) => LO_STATUS.find((s) => s.key === k)!

/**
 * Status efektif LO: Delivered/Closed otomatis dari bongkaran yang memakai
 * LO itu, Proses bila nomor LO belum ada.
 */
export function loStatus(lo: PlanLo, used: Map<string, ReportSummary>): LoDisplayStatus {
  if (lo.status === 'deleted') return 'deleted'
  const r = used.get(lo.id)
  // Closed hanya bila BA sudah ditandatangani pengawas & ABH; sebelum itu tetap Delivered.
  if (r) return sudahClosing(r) ? 'closed' : 'delivered'
  if (!lo.noLO.trim()) return 'proses'
  return lo.status
}

/** SO atau LO belum terbit dari depot (disorot oranye di Tracking LO); LO yang dihapus tidak dihitung. */
export const belumTerbit = (plan: Plan, lo: PlanLo) => lo.status !== 'deleted' && (!plan.noSO.trim() || !lo.noLO.trim())

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
    ...(p.revisiDev ? { revisiDev: p.revisiDev } : {}),
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
    riwayat: p.riwayat ?? [],
  }
}

/** Batas catatan riwayat per permintaan (yang terlama dibuang). */
const RIWAYAT_MAKS = 60

/**
 * Catatan perubahan dari plan lama ke baru: permintaan dibuat, SO/LO terbit atau diubah, status LO, alih supply,
 * volume, dan tanggal kirim. Dipakai otomatis setiap plan disimpan.
 */
export function jejakPerubahan(lama: Plan | undefined, baru: Plan, oleh: string, waktu = Date.now()): JejakPlan[] {
  const j = (x: Omit<JejakPlan, 'waktu' | 'oleh'>): JejakPlan => ({ waktu, oleh, ...x })
  if (!lama) {
    const out = [j({ jenis: 'buat', teks: `Permintaan MS2 dibuat: ${baru.los.length} LO, kirim ${formatTanggalIso(baru.tanggal)}` })]
    if (baru.noSO.trim()) out.push(j({ jenis: 'so', teks: `SO ${baru.noSO} terbit` }))
    for (const lo of baru.los) if (lo.noLO.trim()) out.push(j({ jenis: 'lo', loId: lo.id, teks: `LO ${lo.noLO} terbit (${lo.produk})` }))
    return out
  }
  const out: JejakPlan[] = []
  if (lama.noSO.trim() !== baru.noSO.trim())
    out.push(j({ jenis: 'so', teks: lama.noSO.trim() ? `No SO diubah ${lama.noSO} → ${baru.noSO || '-'}` : `SO ${baru.noSO} terbit` }))
  if (lama.tanggal !== baru.tanggal) out.push(j({ jenis: 'ubah', teks: `Tanggal kirim diubah ${formatTanggalIso(lama.tanggal)} → ${formatTanggalIso(baru.tanggal)}` }))
  for (const lo of baru.los) {
    const a = lama.los.find((x) => x.id === lo.id)
    if (!a) {
      out.push(j({ jenis: 'ubah', loId: lo.id, teks: `LO ${lo.produk} ${lo.noLO ? lo.noLO + ' ' : ''}ditambahkan` }))
      continue
    }
    if (a.noLO.trim() !== lo.noLO.trim()) out.push(j({ jenis: 'lo', loId: lo.id, teks: a.noLO.trim() ? `No LO diubah ${a.noLO} → ${lo.noLO || '-'}` : `LO ${lo.noLO} terbit (${lo.produk})` }))
    if (a.status !== lo.status) out.push(j({ jenis: 'status', loId: lo.id, status: lo.status, teks: `Status ${lo.produk}: ${loStatusMeta(a.status).label} → ${loStatusMeta(lo.status).label}` }))
    if ((a.supplyPoint || '') !== (lo.supplyPoint || '') && lo.supplyPoint) out.push(j({ jenis: 'ubah', loId: lo.id, teks: `Alih supply ke ${lo.supplyPoint}` }))
    if (a.volume !== lo.volume) out.push(j({ jenis: 'ubah', loId: lo.id, teks: `Volume ${lo.produk} diubah ${a.volume.toLocaleString('id-ID')} → ${lo.volume.toLocaleString('id-ID')} L` }))
  }
  return out
}

/** Plan baru dengan riwayat lama + perubahan terbaru (dibatasi RIWAYAT_MAKS). */
export function denganJejak(lama: Plan | undefined, baru: Plan, oleh: string): Plan {
  const riwayat = [...(lama?.riwayat ?? baru.riwayat ?? []), ...jejakPerubahan(lama, baru, oleh)]
  return { ...baru, riwayat: riwayat.slice(-RIWAYAT_MAKS) }
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
