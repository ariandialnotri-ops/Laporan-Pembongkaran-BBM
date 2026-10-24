/**
 * Laporan Operasional SPBU dalam format Excel asli (public/templates/ops-template.xlsx):
 * kartu perawatan, checklist housekeeping, sumur pantau, oil catcher, dan breakdown
 * (dari laporan kerusakan modul Insiden). Sheet Cek Tera, Kualitas Harian, dan Persediaan
 * BBM tidak disertakan karena sudah diunduh dari modul masing-masing.
 */
import type { InsidenRecord } from '@/lib/daily'
import { FORM_OIL, FORM_SUMUR, formTangki, OPS_FORMS, OPS_KEPALA, opsId, PER_TANGKI, tangkiOps, type OpsRecord, type TangkiOps } from '@/lib/ops'
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

/** Kartu per tangki (format asli: satu kartu per tangki pendam) -> sheet template. */
const SHEET_TANGKI: Record<string, string> = {
  'PERAWATAN POMPA': 'PERAWATAN POMPA',
  'PERAWATAN TANGKI': 'PERAWATAN TANGKI',
  'KARTU PERAWATAN POMPA & TANGKI': 'KARTU POMPA & TANGKI',
}

/**
 * Kepala kartu di luar kartu pertama tiap sheet (template asli masih berisi kode SPBU, bulan, dan contoh
 * kapasitas dari SPBU lain); ditulis ulang supaya setiap kartu memuat SPBU & periode laporan.
 */
const KEPALA_LAIN: [string, string, string][] = [
  ['Kartu Perawatan', 'B36', 'SPBU   : {KODE}'],
  ['Kartu Perawatan', 'B37', 'BULAN : {BULAN}'],
  ['Kartu Perawatan', 'B38', 'TAHUN : {TAHUN}'],
  ['Kartu Perawatan', 'B70', 'SPBU   : {KODE}'],
  ['Kartu Perawatan', 'B71', 'BULAN : {BULAN} {TAHUN}'],
  ['Kartu Perawatan', 'B101', 'SPBU   : {KODE}'],
  ['Kartu Perawatan', 'B102', 'BULAN : {BULAN} {TAHUN}'],
  ['Kartu Perawatan', 'E102', 'Kapasitas        :   KVA'],
  ['TOTEM & KANOPI', 'C33', '{KODE}'],
  ['TOTEM & KANOPI', 'C34', '{BULAN}'],
  ['TOTEM & KANOPI', 'C35', '{TAHUN}'],
  ['KARTU PERAWATAN OUTLET RITEL', 'B5', 'SPBU : {KODE}'],
  ['LISPLANG KANOPY RAMBU2 DLL', 'B4', 'SPBU    :  {KODE}'],
  ...[33, 61, 88, 113, 138, 159, 185, 211, 240].flatMap((r): [string, string, string][] => [
    ['Checklist Housekeeping', `C${r}`, 'SPBU   : {KODE}'],
    ['Checklist Housekeeping', `C${r + 1}`, 'BULAN : {BULAN} {TAHUN}'],
  ]),
]

/** Kartu per halaman PDF (sheet yang memuat beberapa kartu): baris awal-akhir dan form pemiliknya. */
export const HALAMAN_SHEET: Record<string, { rows: [number, number]; form?: string }[]> = {
  'Kartu Perawatan': [
    { rows: [1, 32], form: 'apar-harian' },
    { rows: [33, 66], form: 'panel-listrik' },
    { rows: [67, 97], form: 'genset' },
  ],
  'Checklist Housekeeping': [
    { rows: [1, 29], form: 'hk-driveway' },
    { rows: [30, 57], form: 'hk-mushola' },
    { rows: [58, 84], form: 'hk-wudhu' },
    { rows: [85, 109], form: 'hk-kantor' },
    { rows: [110, 134], form: 'hk-enduro' },
    { rows: [135, 155], form: 'hk-taman' },
    { rows: [156, 181], form: 'hk-toilet' },
    { rows: [182, 207], form: 'hk-gudang' },
    { rows: [208, 236], form: 'hk-ruang-buh' },
    { rows: [237, 259], form: 'hk-ruang-istirahat' },
  ],
  'TOTEM & KANOPI': [
    { rows: [1, 29], form: 'totem' },
    { rows: [30, 56], form: 'kanopi-pompa' },
  ],
}

/** Satu sheet hasil: `dari` = sheet template asalnya (kartu per tangki disalin dari sheet yang sama). */
export interface LembarOps {
  nama: string
  dari: string
  cells: Record<string, CellSpec>
  /** Kartu per tangki: tangki pemiliknya. */
  tangki?: TangkiOps
}

const kl = (liter: number) => `${(Math.round((liter / 1000) * 10) / 10).toLocaleString('id-ID')} KL`

/** Nama sheet kartu per tangki (maks. 31 karakter, unik). */
function namaSheetTangki(dasar: string, t: TangkiOps, dipakai: Set<string>) {
  const sfx = /^\d+$/.test(t.tankNo.trim()) ? `T${t.tankNo.trim()}` : t.tankNo.replace(/[\\/?*[\]:']/g, ' ').trim()
  let nama = `${dasar} ${sfx}`.slice(0, 31).trim()
  for (let i = 2; dipakai.has(nama); i++) nama = `${`${dasar} ${sfx}`.slice(0, 28).trim()} ${i}`
  dipakai.add(nama)
  return nama
}

/** Isi semua sel laporan operasional satu bulan, dipakai bersama oleh Excel dan PDF (format asli). */
export function isiOps({ tahun, bulan, recs, kerusakan, settings }: Omit<OpsExportInput, 'filename'>, tanks: TangkiOps[] = tangkiOps()) {
  const jumlahHari = new Date(tahun, bulan, 0).getDate()
  const byId = new Map(recs.map((r) => [r.id, r]))
  const kota = (settings.namaSpbu || '').replace(/^SPBU\s*/i, '').trim()
  const pengawas = settings.namaPengawasDefault?.trim() || ''
  const ganti = (teks: string) =>
    teks.replaceAll('{KODE}', settings.kodeSpbu || '').replaceAll('{KOTA}', kota).replaceAll('{BULAN}', BULAN[bulan - 1]).replaceAll('{TAHUN}', String(tahun))

  // Sheet hasil: kartu pompa/tangki disalin per tangki pendam; tanpa database tangki satu kartu umum.
  const dipakai = new Set<string>()
  const salinan = new Map<string, { nama: string; t: TangkiOps }[]>()
  if (tanks.length) for (const dasar of Object.keys(SHEET_TANGKI)) salinan.set(dasar, tanks.map((t) => ({ nama: namaSheetTangki(SHEET_TANGKI[dasar], t, dipakai), t })))
  const lembar = new Map<string, LembarOps>()
  const buka = (nama: string, dari: string, tangki?: TangkiOps) => {
    if (!lembar.has(nama)) lembar.set(nama, { nama, dari, cells: {}, tangki })
    return lembar.get(nama)!
  }
  /** Sheet tujuan untuk sheet template (salinan per tangki: semua salinan, atau satu tangki tertentu). */
  const tujuan = (sheet: string, tankId?: string) => {
    const s = salinan.get(sheet)
    if (!s) return [buka(sheet, sheet)]
    return s.filter((x) => !tankId || x.t.id === tankId).map((x) => buka(x.nama, sheet, x.t))
  }
  const tulis = (sheet: string, ref: string, value: CellSpec['value'], fmt?: string, tankId?: string) => {
    for (const l of tujuan(sheet, tankId)) l.cells[ref] = fmt ? { value, fmt } : { value }
  }

  // Judul: kode SPBU, bulan, tahun di setiap kartu.
  for (const [sheet, ref, teks] of OPS_KEPALA) tulis(sheet, ref, teks === '{TAHUN#}' ? tahun : ganti(teks))
  for (const [sheet, ref, teks] of KEPALA_LAIN) tulis(sheet, ref, ganti(teks))

  // Kepala kartu per tangki: produk, kapasitas, no tangki. Merk/tipe/nomor seri pompa diisi tangan (contoh template dikosongkan).
  const isiTangki = (t: TangkiOps | null) => {
    const id = t?.id
    tulis('PERAWATAN POMPA', 'I5', null, undefined, id)
    tulis('PERAWATAN POMPA', 'I6', t ? t.produk.toUpperCase() : null, undefined, id)
    tulis('PERAWATAN POMPA', 'I7', t?.kapasitas ? kl(t.kapasitas) : null, undefined, id)
    tulis('PERAWATAN POMPA', 'Q5', null, undefined, id)
    tulis('PERAWATAN POMPA', 'Q6', null, undefined, id)
    tulis('PERAWATAN TANGKI', 'I4', null, undefined, id)
    tulis('PERAWATAN TANGKI', 'I5', t ? `${t.kapasitas ? kl(t.kapasitas) : ''} (${t.tankNo})`.trim() : null, undefined, id)
    tulis('PERAWATAN TANGKI', 'R4', null, undefined, id)
    tulis('PERAWATAN TANGKI', 'R5', null, undefined, id)
    tulis('KARTU PERAWATAN POMPA & TANGKI', 'F4', t ? (/^\d+$/.test(t.tankNo.trim()) ? Number(t.tankNo) : t.tankNo) : null, undefined, id)
    tulis('KARTU PERAWATAN POMPA & TANGKI', 'F5', t?.kapasitas ? `( ${kl(t.kapasitas)} )` : null, undefined, id)
    tulis('KARTU PERAWATAN POMPA & TANGKI', 'F6', t?.produk ?? null, undefined, id)
  }
  if (tanks.length) tanks.forEach(isiTangki)
  else isiTangki(null)

  // Kartu perawatan & housekeeping: kosongkan semua kolom hari/bulan, lalu isi tanda.
  for (const f of OPS_FORMS) {
    const kunci = PER_TANGKI.includes(f.id) && tanks.length ? tanks.map((t) => ({ form: formTangki(f.id, t.id), tankId: t.id })) : [{ form: f.id, tankId: undefined }]
    for (const { form, tankId } of kunci) {
      for (const b of f.blok) {
        const lewati = new Set(b.lewati)
        const baris = [...b.baris.map(([r]) => r), ...(b.paraf ? [b.paraf] : [])]
        for (const col of Object.values(b.kolom)) for (const r of baris) if (!lewati.has(`${huruf(col)}${r}`)) tulis(b.sheet, `${huruf(col)}${r}`, null, undefined, tankId)
        for (const [n0, col] of Object.entries(b.kolom)) {
          const n = Number(n0)
          const tanggal = f.periode === 'bulanan' ? iso(tahun, n, 1) : n <= jumlahHari ? iso(tahun, bulan, n) : null
          if (!tanggal || (f.periode === 'bulanan' && n > bulan)) continue
          const rec = byId.get(opsId(form, tanggal))
          if (rec?.data.jenis !== 'checklist') continue
          for (const [r, ai] of b.baris) {
            const ref = `${huruf(col)}${r}`
            const v = rec.data.hasil[ai]
            if (v && !lewati.has(ref)) tulis(b.sheet, ref, v === 'OK' ? f.tanda : v, undefined, tankId)
          }
          if (b.paraf && rec.data.paraf) tulis(b.sheet, `${huruf(col)}${b.paraf}`, inisial(rec.data.paraf.nama), undefined, tankId)
        }
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

  // Urutan mengikuti template; salinan per tangki menggantikan sheet asalnya.
  const urut = TEMPLATE_URUT
  const hasil: LembarOps[] = []
  for (const sheet of urut) {
    const s = salinan.get(sheet)
    if (s) for (const x of s) hasil.push(lembar.get(x.nama) ?? buka(x.nama, sheet, x.t))
    else hasil.push(lembar.get(sheet) ?? buka(sheet, sheet))
  }
  return { lembar: hasil, slotBreakdown: slot }
}

/** Urutan sheet template laporan operasional (tanpa Cek Tera, Kualitas Harian, Persediaan BBM). */
const TEMPLATE_URUT = [
  'PERAWATAN POMPA',
  'PERAWATAN TANGKI',
  'KARTU PERAWATAN OUTLET RITEL',
  'LISPLANG KANOPY RAMBU2 DLL',
  'TOTEM & KANOPI',
  'Kartu Perawatan',
  'Checklist Housekeeping',
  'BREAK DOWN',
  'SUMUR PANTAU',
  'OIL CATCHER',
  'KARTU PERAWATAN POMPA & TANGKI',
]

export async function buatOpsXlsx(input: Omit<OpsExportInput, 'filename'>) {
  const { lembar, slotBreakdown } = isiOps(input)
  const wb = await Workbook.loadTemplate('/templates/ops-template.xlsx')
  for (const nama of SHEET_LAIN) await wb.removeSheet(nama)
  // Kartu per tangki: salin sheet template, lalu hapus sheet asalnya.
  const asal = new Set<string>()
  for (const l of lembar)
    if (l.nama !== l.dari) {
      await wb.cloneSheet(l.dari, l.nama)
      asal.add(l.dari)
    }
  for (const nama of asal) await wb.removeSheet(nama)
  await wb.editSheet(await wb.sheetPath('BREAK DOWN'), (doc) => siapkanBreakdown(doc, slotBreakdown))
  for (const l of lembar) await wb.setCells(await wb.sheetPath(l.nama), l.cells)
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
