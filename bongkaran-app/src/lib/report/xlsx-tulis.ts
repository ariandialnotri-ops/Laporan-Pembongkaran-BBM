/**
 * Penulis file Excel (.xlsx) sederhana tanpa template: teks, angka, rumus (dengan hasil tersimpan),
 * sel gabungan, lebar kolom, garis tabel, huruf tebal, rata, dan format angka. Dipakai untuk BA
 * Laporan Bulanan (stock opname) yang susunannya mengikuti dokumen SPBU.
 */
import JSZip from 'jszip'

export type FormatAngka = 'int' | 'dec1' | 'dec2' | 'rp' | 'pct' | 'akun'
export interface Gaya {
  b?: boolean
  /** Ukuran huruf (bawaan 11). */
  sz?: number
  border?: boolean
  /** Garis satu sisi saja (mis. kepala & kolom tanda tangan voucher). */
  garis?: 'atas' | 'bawah'
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'center'
  wrap?: boolean
  fmt?: FormatAngka
  /** Latar kepala tabel. */
  fill?: boolean
  italic?: boolean
}
export type Nilai = string | number | null | undefined | { f: string; v?: number | string | null }

const NUMFMT: Record<FormatAngka, [number, string]> = {
  int: [164, '#,##0'],
  dec1: [165, '#,##0.0'],
  dec2: [166, '#,##0.00'],
  rp: [167, '"Rp "#,##0'],
  pct: [168, '0.00"%"'],
  akun: [169, '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-;_-@_-'],
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const kolom = (n: number) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
/** "B", 3 → "B3"; kolom boleh angka (1 = A). */
export const ref = (c: number | string, r: number) => `${typeof c === 'number' ? kolom(c) : c}${r}`
const posisi = (r: string) => {
  const m = r.match(/^([A-Z]+)(\d+)$/)!
  return { c: m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0), r: Number(m[2]) }
}

export class Lembar {
  readonly sel = new Map<string, { v: Nilai; g?: Gaya }>()
  readonly gabung: string[] = []
  readonly lebar: Record<number, number> = {}
  readonly nama: string
  constructor(nama: string) {
    this.nama = nama
  }
  set(r: string, v: Nilai, g?: Gaya) {
    this.sel.set(r, { v, g })
    return this
  }
  /** Isi beberapa sel berurutan ke kanan mulai `r`. */
  baris(r: string, vs: Nilai[], g?: Gaya) {
    const p = posisi(r)
    vs.forEach((v, i) => this.set(ref(p.c + i, p.r), v, g))
    return this
  }
  /** Gabung sel; gaya (mis. garis) diterapkan ke semua sel dalam rentang. */
  merge(rentang: string, v?: Nilai, g?: Gaya) {
    const [a, b] = rentang.split(':').map(posisi)
    for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) if (!this.sel.has(ref(c, r)) && g) this.set(ref(c, r), null, g)
    if (v !== undefined || g) this.set(ref(a.c, a.r), v ?? this.sel.get(ref(a.c, a.r))?.v ?? null, g ?? this.sel.get(ref(a.c, a.r))?.g)
    this.gabung.push(rentang)
    return this
  }
  kolom(lebar: Record<string, number>) {
    for (const [k, w] of Object.entries(lebar)) this.lebar[posisi(`${k}1`).c] = w
    return this
  }
}

/** Gaya unik → indeks cellXfs. */
class Gayaan {
  private kunci: string[] = ['[]']
  idx(g?: Gaya) {
    if (!g) return 0
    const k = JSON.stringify(Object.keys(g).sort().map((x) => [x, g[x as keyof Gaya]]))
    let i = this.kunci.indexOf(k)
    if (i < 0) i = this.kunci.push(k) - 1
    return i
  }
  xml() {
    const gs = this.kunci.map((k) => Object.fromEntries(JSON.parse(k) as [string, unknown][]) as Gaya)
    const fonts: string[] = []
    const fontIdx = (g: Gaya) => {
      const f = `<font>${g.b ? '<b/>' : ''}${g.italic ? '<i/>' : ''}<sz val="${g.sz ?? 11}"/><name val="Calibri"/><family val="2"/></font>`
      let i = fonts.indexOf(f)
      if (i < 0) i = fonts.push(f) - 1
      return i
    }
    const xfs = gs.map((g) => {
      const fmt = g.fmt ? NUMFMT[g.fmt][0] : 0
      const al = g.align || g.valign || g.wrap ? `<alignment${g.align ? ` horizontal="${g.align}"` : ''} vertical="${g.valign ?? 'center'}"${g.wrap ? ' wrapText="1"' : ''}/>` : ''
      return `<xf numFmtId="${fmt}" fontId="${fontIdx(g)}" fillId="${g.fill ? 2 : 0}" borderId="${g.border ? 1 : g.garis === 'atas' ? 2 : g.garis === 'bawah' ? 3 : 0}" xfId="0"${fmt ? ' applyNumberFormat="1"' : ''} applyFont="1"${g.fill ? ' applyFill="1"' : ''}${g.border || g.garis ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1"' : ''}>${al}</xf>`
    })
    const garis = '<left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/>'
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${Object.keys(NUMFMT).length}">${Object.values(NUMFMT)
      .map(([id, c]) => `<numFmt numFmtId="${id}" formatCode="${esc(c)}"/>`)
      .join('')}</numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border><border>${garis}</border><border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  }
}

function sheetXml(l: Lembar, gaya: Gayaan) {
  const rows = new Map<number, { c: number; xml: string }[]>()
  for (const [r, { v, g }] of l.sel) {
    const p = posisi(r)
    const s = gaya.idx(g)
    let isi = ''
    if (v === null || v === undefined || v === '') isi = `<c r="${r}" s="${s}"/>`
    else if (typeof v === 'number') isi = Number.isFinite(v) ? `<c r="${r}" s="${s}"><v>${v}</v></c>` : `<c r="${r}" s="${s}"/>`
    else if (typeof v === 'string') isi = `<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    else {
      const hasil = v.v
      isi =
        typeof hasil === 'string'
          ? `<c r="${r}" s="${s}" t="str"><f>${esc(v.f)}</f><v>${esc(hasil)}</v></c>`
          : `<c r="${r}" s="${s}"><f>${esc(v.f)}</f>${typeof hasil === 'number' && Number.isFinite(hasil) ? `<v>${hasil}</v>` : ''}</c>`
    }
    const arr = rows.get(p.r) ?? []
    arr.push({ c: p.c, xml: isi })
    rows.set(p.r, arr)
  }
  const data = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, cs]) => `<row r="${r}">${cs.sort((a, b) => a.c - b.c).map((x) => x.xml).join('')}</row>`)
    .join('')
  const cols = Object.entries(l.lebar)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([c, w]) => `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${data}</sheetData>${l.gabung.length ? `<mergeCells count="${l.gabung.length}">${l.gabung.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/></worksheet>`
}

/** Susun file .xlsx dari lembar-lembar. Excel menghitung ulang rumus saat dibuka. */
export async function tulisXlsx(lembar: Lembar[]): Promise<Blob> {
  const zip = new JSZip()
  // Tanpa entri folder di zip (tidak dipakai format xlsx).
  const file = (nama: string, isi: string) => zip.file(nama, isi, { createFolders: false })
  const gaya = new Gayaan()
  const sheets = lembar.map((l) => sheetXml(l, gaya))
  file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${lembar
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
  )
  file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${lembar
      .map((l, i) => `<sheet name="${esc(l.nama.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  )
  file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${lembar
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${lembar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  sheets.forEach((x, i) => file(`xl/worksheets/sheet${i + 1}.xml`, x))
  file('xl/styles.xml', gaya.xml())
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' })
}
