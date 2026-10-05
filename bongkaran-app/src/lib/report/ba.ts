/**
 * Isi sheet "BERITA ACARA PEMBONGKARAN" dari satu laporan bongkaran.
 * Alamat sel mengikuti template Excel referensi.
 */
import { parseAngka } from '@/lib/format'
import type { Derived, Report, Settings, SignerKey } from '@/lib/sop'
import { tankName } from '@/lib/tank'
import type { CellSpec } from './xlsx'

const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
/** Kolom kompartemen 1-6 pada tabel kualitas (baris 12-17). */
const QCOLS = ['G', 'H', 'K', 'L', 'M', 'N']
/**
 * Area tanda tangan (baris 64-67) per penandatangan di template. Kotak selebar `w` px
 * di tengah kolom judulnya (sama dengan posisi nama di baris 68), rasio sekitar 5:2.
 */
export const BA_SIGN_AREA: Partial<Record<SignerKey, { from: string; to: string; w: number }>> = {
  penerima: { from: 'D64', to: 'D67', w: 180 },
  security: { from: 'G64', to: 'G67', w: 150 },
  supir: { from: 'H64', to: 'K67', w: 240 },
  abh: { from: 'L64', to: 'M67', w: 220 },
}

const n = (v: string | null | undefined) => (v ? parseAngka(v) : null)
/** Nomor panjang (DO, SO, segel) disimpan sebagai angka bila seluruhnya digit, seperti di template. */
const idValue = (s: string) => (/^\d{1,15}$/.test(s.trim()) ? Number(s.trim()) : s.trim() || null)
const round = (v: number, d = 6) => Number(v.toFixed(d))

export interface BaBuild {
  cells: Record<string, CellSpec>
  red: string[]
  signatures: { key: SignerKey; from: string; to: string; w: number; img: string }[]
}

export function buildBa(report: Report, x: Derived, settings: Settings): BaBuild {
  const d = report.data
  const cells: Record<string, CellSpec> = {}
  const set = (ref: string, value: CellSpec['value'], formula?: string | null) => {
    cells[ref] = formula === undefined ? { value } : { value, formula }
  }

  // Identitas SPBU & kedatangan
  set('G3', settings.namaSpbu || null)
  set('G4', settings.kodeSpbu || null)
  set('G5', settings.alamatSpbu || null)
  set('L3', 'Form : F 003 / OPR', null)
  const tgl = d.tanggalDatang ? new Date(`${d.tanggalDatang}T00:00:00`) : null
  set('C7', tgl ? HARI[tgl.getDay()] : null)
  set('F7', tgl)
  set('I7', d.jamDatang || null)
  set('M7', d.produk ? d.produk.toUpperCase() : null)
  set('E8', d.nopol || null)
  set('J8', (d.perusahaanPengangkut || settings.perusahaanPengangkut || '').toUpperCase() || null)
  set('D9', d.noLOs.length === 1 ? idValue(d.noLOs[0]) : d.noLOs.join(', ') || null)
  set('D10', d.noSO ? idValue(d.noSO) : null)

  // Pemeriksaan kualitas per kompartemen
  QCOLS.forEach((col, i) => {
    const comp = d.compartments[i]
    const r = comp ? x.densityResults.find((t) => t.kompartemenId === comp.id && t.d15) : undefined
    const obs = r?.obs ?? null
    const d15 = r?.d15?.value ?? null
    const depot = r ? x.d15Depot : null
    set(`${col}13`, obs)
    set(`${col}14`, r ? n(r.suhu) : null)
    set(`${col}15`, d15)
    set(`${col}16`, depot)
    set(`${col}17`, round((d15 ?? 0) - (depot ?? 0), 6))
  })

  // Transport loss
  const tankLabel = x.tank ? `T${x.tank.tankNo}` : null
  let totalKap = 0
  let totalLoss = 0
  for (let i = 0; i < 6; i++) {
    const row = 24 + i
    const c = x.compartments[i]
    const dip = c ? n(c.dipAktual) : null
    const tera = c ? n(c.tinggiTera) : null
    const kap = c ? n(c.kapasitas) : null
    set(`E${row}`, c ? tankLabel : null)
    set(`G${row}`, c?.noSegel ? idValue(c.noSegel) : null)
    set(`H${row}`, dip)
    set(`K${row}`, tera)
    const sel = dip !== null && tera !== null ? round(dip - tera, 4) : 0
    set(`L${row}`, sel)
    set(`M${row}`, kap)
    const kep = c ? n(c.kepekaan) : null
    const mmPerL = c ? n(c.kepekaanMmL ?? '') : null
    if (dip !== null && tera && kep) {
      // Kepekaan buku tera (L/mm): selisih liter = selisih mm x kepekaan.
      const liter = sel * kep
      totalLoss += liter
      set(`N${row}`, round(liter, 6), `L${row}*${kep}`)
    } else if (dip !== null && tera && mmPerL) {
      // Laporan lama: kepekaan mm per liter.
      const liter = sel / mmPerL
      totalLoss += liter
      set(`N${row}`, round(liter, 6), `L${row}/${mmPerL}`)
    } else if (dip !== null && tera && kap !== null) {
      const liter = sel * (kap / tera)
      totalLoss += liter
      set(`N${row}`, round(liter, 6), `L${row}*(M${row}/K${row})`)
    } else set(`N${row}`, null, null)
    totalKap += kap ?? 0
  }
  const limit = round(totalKap * -0.0015, 6)
  set('K30', limit)
  set('N30', round(totalLoss, 6))
  const red = totalLoss < limit ? ['N30'] : []

  // Discharge loss (ATG, level dalam cm)
  set('F37', x.tank ? tankName(x.tank.tankNo).toUpperCase() : 'TANGKI')
  const lvlAwal = n(d.atgBefore.tinggi)
  const lvlAkhir = n(d.atgAfter.tinggi)
  const awal = x.stokAwal
  const terima = x.volumeDO
  const teoritis = (awal ?? 0) + (terima ?? 0)
  const real = x.realStok
  set('F40', lvlAwal !== null ? round(lvlAwal / 10, 2) : null)
  set('H40', awal)
  set('H41', terima)
  set('H42', round(teoritis, 4))
  set('F43', lvlAkhir !== null ? round(lvlAkhir / 10, 2) : null)
  set('H43', real)
  set('H44', round((real ?? 0) - teoritis, 4))
  set('H45', x.penjualan || 0)
  set('H46', round((real ?? 0) - teoritis + (x.penjualan || 0), 4))

  // Penjualan selama pembongkaran (6 baris nozzle)
  let totalJual = 0
  for (let i = 0; i < 6; i++) {
    const row = 52 + i
    const t = x.totalisator[i]
    set(`B${row}`, t ? t.nozzle : null, null)
    set(`E${row}`, t ? n(t.awal) : null)
    set(`H${row}`, t ? n(t.akhir) : null)
    const jual = t?.jual ?? 0
    totalJual += jual
    set(`L${row}`, round(jual, 4))
  }
  set('L58', round(totalJual, 4))

  // Nama penandatangan
  const ttd = d.ttd ?? {}
  set('D68', ttd.penerima?.nama || d.namaPetugas || null)
  set('G68', ttd.security?.nama || null)
  set('H68', ttd.supir?.nama || d.namaDriver || null)
  set('L68', ttd.abh?.nama || null)

  const signatures = (Object.entries(BA_SIGN_AREA) as [SignerKey, { from: string; to: string; w: number }][])
    .filter(([k]) => ttd[k]?.img)
    .map(([k, area]) => ({ key: k, ...area, img: ttd[k]!.img }))

  return { cells, red, signatures }
}
