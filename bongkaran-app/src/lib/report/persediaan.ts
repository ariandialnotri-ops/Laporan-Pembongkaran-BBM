/**
 * Isi sheet "Catatan Persediaan BBM" (per produk/tangki, satu baris per
 * shift) dari stok awal shift, data bongkaran, dan pengeluaran dispenser.
 *
 *   a stok awal shift        b volume penerimaan PNBP (DO)
 *   c penerimaan aktual      d = c - b
 *   e pengeluaran dispenser  f = a + c - e (stok akhir teoritis)
 *   g stok akhir aktual (stok awal shift berikutnya)   h = g - f
 */
import type { StokRecord } from '@/lib/daily'
import { parseAngka } from '@/lib/format'
import { nextShift, shiftId, type Shift } from '@/lib/shift'
import type { ReportSummary } from '@/lib/sop'
import type { CellSpec } from './xlsx'

export const ROWS_PER_PAGE = 15
const FIRST_ROW = 16

export interface PersediaanRow {
  tanggal: string
  shift: Shift
  a: number | null
  nopol: string
  pnbp: string
  sebelum: number | null
  b: number | null
  c: number | null
  d: number | null
  e: number | null
  f: number | null
  g: number | null
  h: number | null
}

const r2 = (v: number) => Number(v.toFixed(3))

export function persediaanRows(produk: string, from: string, to: string, stok: StokRecord[], reports: ReportSummary[]): PersediaanRow[] {
  const byShift = new Map(stok.map((s) => [shiftId(s), s]))
  const receipts = reports.filter((r) => r.produk === produk && r.status !== 'draft' && r.shift)
  const keys = new Map<string, { tanggal: string; shift: Shift }>()
  for (const s of stok) if (s.data.items[produk] && s.tanggal >= from && s.tanggal <= to) keys.set(shiftId(s), { tanggal: s.tanggal, shift: s.shift })
  for (const r of receipts)
    if (r.tanggalShift >= from && r.tanggalShift <= to) keys.set(shiftId({ tanggal: r.tanggalShift, shift: r.shift! }), { tanggal: r.tanggalShift, shift: r.shift! })

  return [...keys.values()]
    .sort((x, y) => x.tanggal.localeCompare(y.tanggal) || x.shift - y.shift)
    .map((k) => {
      const item = byShift.get(shiftId(k))?.data.items[produk]
      const next = byShift.get(shiftId(nextShift(k)))?.data.items[produk]
      const rc = receipts.filter((r) => r.tanggalShift === k.tanggal && r.shift === k.shift).sort((x, y) => x.jam.localeCompare(y.jam))
      const a = item ? parseAngka(item.volume) : null
      const e = item ? parseAngka(item.pengeluaran) : null
      const b = rc.length ? rc.reduce((s, r) => s + (r.volumeDO ?? 0), 0) : null
      const c = rc.length ? rc.reduce((s, r) => s + (r.terimaAktual ?? 0), 0) : null
      const g = next ? parseAngka(next.volume) : null
      const f = a !== null ? r2(a + (c ?? 0) - (e ?? 0)) : null
      return {
        ...k,
        a,
        nopol: rc.map((r) => r.nopol).filter(Boolean).join(' / '),
        pnbp: rc.flatMap((r) => r.noLOs).join(', '),
        sebelum: rc[0]?.stokAwal ?? null,
        b,
        c,
        d: b !== null && c !== null ? r2(c - b) : null,
        e,
        f,
        g,
        h: g !== null && f !== null ? r2(g - f) : null,
      }
    })
}

/** Sel untuk satu halaman (maksimal 15 baris). */
export function persediaanCells(page: PersediaanRow[], header: { noSpbu: string; produk: string; tangki: string }): Record<string, CellSpec> {
  const cells: Record<string, CellSpec> = {
    C6: { value: header.noSpbu || null },
    I6: { value: header.produk.toUpperCase() || null },
    O6: { value: /^\d+$/.test(header.tangki) ? Number(header.tangki) : header.tangki || null },
  }
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const row = FIRST_ROW + i
    const r = page[i]
    const put = (col: string, v: CellSpec['value']) => (cells[`${col}${row}`] = { value: v })
    // Kolom tanggal template berformat General: tulis sebagai teks agar tidak tampil sebagai nomor seri.
    put('B', r ? r.tanggal.split('-').reverse().join('/') : null)
    put('C', r ? r.shift : null)
    put('D', r?.a ?? null)
    put('E', r?.nopol || null)
    put('G', r?.pnbp || null)
    put('I', r?.sebelum ?? null)
    put('J', r?.b ?? null)
    put('K', r?.c ?? null)
    put('L', r?.d ?? null)
    put('M', r?.e ?? null)
    put('O', r?.f ?? null)
    put('P', r?.g ?? null)
    put('Q', r?.h ?? null)
  }
  return cells
}

export function paginate<T>(rows: T[], size = ROWS_PER_PAGE): T[][] {
  if (!rows.length) return [[]]
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}
