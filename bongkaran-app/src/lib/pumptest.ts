/**
 * Riwayat pump test: BBM yang dikeluarkan nozzle untuk pengujian (bukan penjualan), dari uji kualitas
 * harian (sampel density), uji kuantitas bejana di Q&Q, dan uji takaran 20 L. Dipakai untuk riwayat per
 * nozzle & produk dan rekap tera nozzle di BA stock opname.
 */
import { qqD15, type DailyRecord } from '@/lib/daily'
import { formatDensity, parseAngka } from '@/lib/format'
import { formatMl, opsiLabel, takarStatus } from '@/lib/takar'
import type { Nozzle } from '@/lib/sop'

export type JenisPumpTest = 'kualitas' | 'kuantitas' | 'takaran'
export const LABEL_PUMP_TEST: Record<JenisPumpTest, string> = { kualitas: 'Uji kualitas', kuantitas: 'Uji kuantitas (Q&Q)', takaran: 'Uji takaran' }

export interface BarisPumpTest {
  key: string
  tanggal: string
  shift: number
  jam: string
  jenis: JenisPumpTest
  /** Nama nozzle ('' bila tidak dicatat). */
  nozzle: string
  produk: string
  liter: number
  hasil: string
  /** Hasil di luar toleransi (takaran/bejana). */
  lewat: boolean
  petugas: string
}

/** Cocokkan nama nozzle catatan dengan data utama (uji takaran mengetik nomor nozzle). */
const kunciNozzle = (s: string) => s.trim().replace(/^nozzle\s*/i, '').toUpperCase()

export function barisPumpTest(daily: DailyRecord[], nozzles: Nozzle[]): BarisPumpTest[] {
  const namaDari = (id: string | undefined, nama: string | undefined) => nozzles.find((n) => n.id === id)?.nama ?? nama ?? ''
  const out: BarisPumpTest[] = []
  for (const d of daily) {
    if (d.kind === 'qq') {
      for (const k of d.data.kualitas) {
        const l = parseAngka(k.pumpTest)
        if (!l) continue
        const d15 = qqD15(k).d15
        out.push({ key: `${d.id}.${k.id}`, tanggal: d.tanggal, shift: d.shift, jam: d.data.jam, jenis: 'kualitas', nozzle: namaDari(k.nozzleId, k.nozzle), produk: k.produk, liter: l, hasil: d15 ? `D15 ${formatDensity(d15.value)}` : '-', lewat: false, petugas: d.data.petugas })
      }
      for (const k of d.data.kuantitas) {
        const l = parseAngka(k.pumpTest)
        if (!l) continue
        out.push({ key: `${d.id}.${k.id}`, tanggal: d.tanggal, shift: d.shift, jam: d.data.jam, jenis: 'kuantitas', nozzle: namaDari(k.nozzleId, k.nozzle), produk: k.produk, liter: l, hasil: formatMl(k.selisihMl), lewat: takarStatus(k.selisihMl) === 'lewat', petugas: d.data.petugas })
      }
    } else if (d.kind === 'takar') {
      const nz = nozzles.find((n) => kunciNozzle(n.nama) === kunciNozzle(d.data.nozzle))
      out.push({ key: d.id, tanggal: d.tanggal, shift: d.shift, jam: d.data.jam, jenis: 'takaran', nozzle: nz?.nama ?? d.data.nozzle, produk: nz?.produk ?? d.data.produk, liter: 20, hasil: `${opsiLabel(d.data.opsi)} ${formatMl(d.data.hasilMl)}`, lewat: takarStatus(d.data.hasilMl) === 'lewat', petugas: d.data.petugas })
    }
  }
  return out.sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam))
}

/** Liter pump test per nozzle per tanggal (BA Rekap Tera Nozzle). Kunci: nama nozzle → tanggal → liter. */
export function rekapTeraNozzle(rows: BarisPumpTest[]) {
  const m = new Map<string, { nozzle: string; produk: string; perHari: Map<string, number>; total: number }>()
  for (const r of rows) {
    const k = `${r.nozzle}|${r.produk}`
    const x = m.get(k) ?? { nozzle: r.nozzle, produk: r.produk, perHari: new Map(), total: 0 }
    x.perHari.set(r.tanggal, (x.perHari.get(r.tanggal) ?? 0) + r.liter)
    x.total += r.liter
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => a.nozzle.localeCompare(b.nozzle, 'id', { numeric: true }) || a.produk.localeCompare(b.produk))
}
