/**
 * Tanda "Revised by Developer": dicap database (trigger `bbm_0_revisi_dev`) ke `data.revisiDev` (atau `summary` /
 * `meta`) setiap kali super admin (Admin Aplikasi) mengubah isi data riwayat. Peran lain tidak dapat menghapusnya.
 */
export interface RevisiDev {
  /** Waktu revisi terakhir (ISO). */
  at: string
  oleh: string
  /** Jumlah revisi oleh developer. */
  kali?: number
}

const jadiRevisi = (v: unknown): RevisiDev | null => {
  if (!v || typeof v !== 'object') return null
  const r = (v as { revisiDev?: unknown }).revisiDev
  return r && typeof r === 'object' && typeof (r as RevisiDev).at === 'string' ? (r as RevisiDev) : null
}

/**
 * Cari tanda revisi pada bentuk baris riwayat yang umum: ringkasan/plan (`x.revisiDev`), catatan (`x.data.revisiDev`),
 * atau baris turunan yang membungkus catatan (`x.r`, `x.rec`, `x.plan`, `x.report`).
 */
export function revisiDari(x: unknown): RevisiDev | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  return jadiRevisi(o) ?? jadiRevisi(o.data) ?? revisiDari(o.r) ?? revisiDari(o.rec) ?? revisiDari(o.plan) ?? revisiDari(o.report) ?? null
}
