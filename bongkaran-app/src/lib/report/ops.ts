/**
 * Laporan Operasional SPBU dalam format Excel asli (public/templates/ops-template.xlsx):
 * kartu perawatan, checklist housekeeping, sumur pantau, oil catcher, dan breakdown
 * (dari laporan kerusakan modul Insiden). Sheet Cek Tera, Kualitas Harian, dan Persediaan
 * BBM tidak disertakan karena sudah diunduh dari modul masing-masing.
 */
import type { InsidenRecord } from '@/lib/daily'
import { FORM_OIL, FORM_SUMUR, OPS_FORMS, OPS_KEPALA, opsId, type OpsRecord } from '@/lib/ops'
import type { Settings } from '@/lib/sop'
import { Workbook, type CellSpec } from './xlsx'

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']
const SHEET_LAIN = ['Cek Terra Harian', 'Catatan Kualitas Harian', 'Catatan Persediaan BBM']

const huruf = (col: number) => {
  let s = ''
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const tgl = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const kapital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** Paraf: inisial nama pengawas (mis. "Rian Saputra" -> "RS", "Rian" -> "RI"). */
export function inisial(nama: string) {
  const kata = nama.trim().split(/\s+/).filter(Boolean)
  if (!kata.length) return ''
  return (kata.length === 1 ? kata[0].slice(0, 2) : kata.slice(0, 3).map((k) => k[0]).join('')).toUpperCase()
}

export interface OpsExportInput {
  tahun: number
  /** 1-12 */
  bulan: number
  /** Catatan bbm_ops dari 1 Januari sampai akhir bulan (form bulanan memakai kolom per bulan). */
  recs: OpsRecord[]
  /** Laporan insiden jenis kerusakan pada bulan itu (sheet BREAK DOWN). */
  kerusakan: InsidenRecord[]
  settings: Settings
  filename: string
}

export async function buatOpsXlsx({ tahun, bulan, recs, kerusakan, settings }: Omit<OpsExportInput, 'filename'>) {
  const wb = await Workbook.loadTemplate('/templates/ops-template.xlsx')
  for (const nama of SHEET_LAIN) await wb.removeSheet(nama)
  const jumlahHari = new Date(tahun, bulan, 0).getDate()
  const byId = new Map(recs.map((r) => [r.id, r]))
  const kota = (settings.namaSpbu || '').replace(/^SPBU\s*/i, '').trim()
  const pengawas = settings.namaPengawasDefault?.trim() || ''

  // Sel per sheet dikumpulkan dulu lalu ditulis sekali per sheet.
  const isi = new Map<string, Record<string, CellSpec>>()
  const tulis = (sheet: string, ref: string, value: CellSpec['value'], fmt?: string) => {
    const m = isi.get(sheet) ?? {}
    m[ref] = fmt ? { value, fmt } : { value }
    isi.set(sheet, m)
  }

  // Judul: kode SPBU, bulan, tahun.
  for (const [sheet, ref, teks] of OPS_KEPALA) {
    if (teks === '{TAHUN#}') tulis(sheet, ref, tahun)
    else tulis(sheet, ref, teks.replaceAll('{KODE}', settings.kodeSpbu || '').replaceAll('{KOTA}', kota).replaceAll('{BULAN}', BULAN[bulan - 1]).replaceAll('{TAHUN}', String(tahun)))
  }

  // Kartu perawatan & housekeeping: kosongkan semua kolom hari/bulan, lalu isi tanda.
  for (const f of OPS_FORMS) {
    for (const b of f.blok) {
      const lewati = new Set(b.lewati)
      const baris = [...b.baris.map(([r]) => r), ...(b.paraf ? [b.paraf] : [])]
      for (const col of Object.values(b.kolom)) for (const r of baris) if (!lewati.has(`${huruf(col)}${r}`)) tulis(b.sheet, `${huruf(col)}${r}`, null)
      for (const [kunci, col] of Object.entries(b.kolom)) {
        const n = Number(kunci)
        const tanggal = f.periode === 'bulanan' ? iso(tahun, n, 1) : n <= jumlahHari ? iso(tahun, bulan, n) : null
        if (!tanggal || (f.periode === 'bulanan' && n > bulan)) continue
        const rec = byId.get(opsId(f.id, tanggal))
        if (rec?.data.jenis !== 'checklist') continue
        for (const [r, ai] of b.baris) {
          const ref = `${huruf(col)}${r}`
          const v = rec.data.hasil[ai]
          if (v && !lewati.has(ref)) tulis(b.sheet, ref, v === 'OK' ? f.tanda : v)
        }
        if (b.paraf && rec.data.paraf) tulis(b.sheet, `${huruf(col)}${b.paraf}`, inisial(rec.data.paraf.nama))
      }
    }
  }

  // Sumur pantau (baris 7-37) & oil catcher (baris 6-36), satu baris per tanggal.
  let parafEnv = ''
  for (let d = 1; d <= 31; d++) {
    const r1 = 6 + d
    const r2 = 5 + d
    const ada = d <= jumlahHari
    tulis('SUMUR PANTAU', `C${r1}`, ada ? new Date(tahun, bulan - 1, d) : null)
    tulis('OIL CATCHER', `C${r2}`, ada ? new Date(tahun, bulan - 1, d) : null)
    const s = ada ? byId.get(opsId(FORM_SUMUR, iso(tahun, bulan, d)))?.data : undefined
    const o = ada ? byId.get(opsId(FORM_OIL, iso(tahun, bulan, d)))?.data : undefined
    const sumur = s?.jenis === 'sumur' ? s : null
    const oil = o?.jenis === 'oil' ? o : null
    ;['D', 'E', 'F', 'G'].forEach((c, i) => tulis('SUMUR PANTAU', `${c}${r1}`, sumur?.sumur[i] ?? null))
    tulis('SUMUR PANTAU', `H${r1}`, sumur?.hasil || null)
    tulis('SUMUR PANTAU', `J${r1}`, sumur?.keterangan || null)
    tulis('OIL CATCHER', `D${r2}`, oil?.kondisi ?? null)
    tulis('OIL CATCHER', `E${r2}`, oil?.hasil || null)
    tulis('OIL CATCHER', `H${r2}`, oil?.keterangan || null)
    parafEnv = sumur?.paraf?.nama || oil?.paraf?.nama || parafEnv
  }
  tulis('SUMUR PANTAU', 'J38', `${kapital(kota.split(/\s+/).pop() || '')}, ${jumlahHari} ${kapital(BULAN[bulan - 1])} ${tahun}`)
  tulis('SUMUR PANTAU', 'B46', `( ${parafEnv || pengawas || '....................'} )`)

  // Breakdown: satu entri = dua baris (7-8, 9-10, ...); baris tambahan meniru entri terakhir template.
  const daftar = [...kerusakan].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  const slot = Math.max(4, daftar.length)
  const bdPath = await wb.sheetPath('BREAK DOWN')
  await wb.editSheet(bdPath, (doc) => siapkanBreakdown(doc, slot))
  for (let i = 0; i < slot; i++) {
    const r = 7 + i * 2
    const x = daftar[i]
    const selesai = x?.data.riwayat.find((l) => l.status === 'selesai')
    const tindakan = x ? [x.data.tindakanSegera, ...x.data.riwayat.slice(1).map((l) => l.catatan)].filter(Boolean).join('; ') : null
    tulis('BREAK DOWN', `B${r}`, x ? i + 1 : null)
    tulis('BREAK DOWN', `C${r}`, x ? x.data.aset || x.data.kategori : null)
    tulis('BREAK DOWN', `D${r}`, x ? x.data.uraian : null)
    tulis('BREAK DOWN', `E${r}`, tindakan)
    tulis('BREAK DOWN', `F${r}`, x ? x.data.pic || x.data.pelapor : null)
    tulis('BREAK DOWN', `G${r}`, x ? tgl(x.tanggal) : null, 'dd/mm/yyyy')
    tulis('BREAK DOWN', `H${r}`, x ? tgl(x.data.riwayat[0]?.at || x.tanggal) : null, 'dd/mm/yyyy')
    const proses = x?.data.riwayat.find((l) => l.status === 'proses')
    tulis('BREAK DOWN', `I${r}`, proses ? tgl(proses.at) : null, 'dd/mm/yyyy')
    tulis('BREAK DOWN', `J${r}`, selesai ? tgl(selesai.at) : null, 'dd/mm/yyyy')
  }

  for (const [sheet, cells] of isi) await wb.setCells(await wb.sheetPath(sheet), cells)
  await wb.cleanup()
  return wb.toBlob()
}

/** Pastikan sheet BREAK DOWN punya `slot` entri dua-baris yang tergabung per kolom (B-J). */
function siapkanBreakdown(doc: Document, slot: number) {
  const sheetData = doc.getElementsByTagNameNS(MAIN, 'sheetData')[0]
  const rows = () => [...sheetData.getElementsByTagNameNS(MAIN, 'row')]
  const row = (r: number) => rows().find((x) => Number(x.getAttribute('r')) === r)
  const contohA = row(13)
  const contohB = row(14)
  for (let i = 4; i < slot && contohA && contohB; i++) {
    const r = 7 + i * 2
    for (const [src, rr] of [
      [contohA, r],
      [contohB, r + 1],
    ] as const) {
      const baru = src.cloneNode(true) as Element
      baru.setAttribute('r', String(rr))
      for (const c of [...baru.getElementsByTagNameNS(MAIN, 'c')]) {
        c.setAttribute('r', c.getAttribute('r')!.replace(/\d+$/, String(rr)))
        for (const ch of [...c.children]) ch.remove()
      }
      sheetData.appendChild(baru)
    }
  }
  let merges = doc.getElementsByTagNameNS(MAIN, 'mergeCells')[0]
  if (!merges) {
    merges = doc.createElementNS(MAIN, 'mergeCells')
    sheetData.parentNode!.insertBefore(merges, sheetData.nextSibling)
  }
  const ada = new Set([...merges.getElementsByTagNameNS(MAIN, 'mergeCell')].map((m) => m.getAttribute('ref')))
  for (let i = 0; i < slot; i++) {
    const r = 7 + i * 2
    for (const c of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
      const ref = `${c}${r}:${c}${r + 1}`
      if (ada.has(ref)) continue
      const m = doc.createElementNS(MAIN, 'mergeCell')
      m.setAttribute('ref', ref)
      merges.appendChild(m)
    }
  }
  merges.setAttribute('count', String(merges.getElementsByTagNameNS(MAIN, 'mergeCell').length))
  doc.getElementsByTagNameNS(MAIN, 'dimension')[0]?.setAttribute('ref', `A1:J${Math.max(14, 6 + slot * 2)}`)
}

export async function exportOpsXlsx(input: OpsExportInput) {
  const url = URL.createObjectURL(await buatOpsXlsx(input))
  const a = document.createElement('a')
  a.href = url
  a.download = input.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
