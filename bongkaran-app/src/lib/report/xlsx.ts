/**
 * Mengisi file template Excel asli (public/templates/floq-template.xlsx)
 * langsung di level XML, sehingga font, logo, garis tabel, sel gabungan,
 * dan format angka tetap persis seperti template.
 *
 * Perubahan struktur yang dilakukan hanya yang perlu:
 * - nilai sel diisi, rumus template dipertahankan (dengan hasil tersimpan)
 * - tautan ke file Excel lain (external link) diganti nilai, agar Excel
 *   tidak meminta "update links"
 * - sheet yang tidak dipakai dihapus, sheet Catatan Persediaan digandakan
 *   bila baris lebih dari 15
 * - tanda tangan ditempel sebagai gambar di kolom tanda tangan
 */
import JSZip from 'jszip'
import { dateToSerial, type CellValue } from './numfmt'

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
const DRAWING_CT = 'application/vnd.openxmlformats-officedocument.drawing+xml'
const SHEET_CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'

export interface CellSpec {
  value: CellValue
  /** undefined = rumus template dipertahankan; null = rumus dihapus; string = rumus baru. */
  formula?: string | null
}

export interface ImageSpec {
  /** Kolom/baris 0-based dan offset dalam piksel. */
  col: number
  colOffPx: number
  row: number
  rowOffPx: number
  widthPx: number
  heightPx: number
  png: Uint8Array
  name: string
}

const colIndex = (letters: string) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const refParts = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/)!
  return { c: colIndex(m[1]), r: Number(m[2]) }
}
const px2emu = (px: number) => Math.round(px * 9525)

export class Workbook {
  private docs = new Map<string, Document>()
  private zip: JSZip
  private constructor(zip: JSZip) {
    this.zip = zip
  }

  static async loadTemplate() {
    const res = await fetch('/templates/floq-template.xlsx')
    if (!res.ok) throw new Error('Template laporan tidak ditemukan')
    return new Workbook(await JSZip.loadAsync(await res.arrayBuffer()))
  }

  private async doc(path: string) {
    let d = this.docs.get(path)
    if (!d) {
      const text = await this.zip.file(path)?.async('string')
      if (text === undefined) throw new Error(`Bagian ${path} tidak ada di template`)
      d = new DOMParser().parseFromString(text, 'application/xml')
      this.docs.set(path, d)
    }
    return d
  }

  /** Path XML sheet berdasarkan nama tab. */
  async sheetPath(name: string) {
    const wb = await this.doc('xl/workbook.xml')
    const rels = await this.doc('xl/_rels/workbook.xml.rels')
    const sheet = [...wb.getElementsByTagNameNS(MAIN, 'sheet')].find((s) => s.getAttribute('name') === name)
    if (!sheet) throw new Error(`Sheet ${name} tidak ada`)
    const rid = sheet.getAttributeNS(REL, 'id')
    const rel = [...rels.getElementsByTagNameNS(PKG, 'Relationship')].find((r) => r.getAttribute('Id') === rid)!
    return `xl/${rel.getAttribute('Target')}`
  }

  async setCells(sheetPath: string, cells: Record<string, CellSpec>) {
    const d = await this.doc(sheetPath)
    const sheetData = d.getElementsByTagNameNS(MAIN, 'sheetData')[0]
    for (const [ref, spec] of Object.entries(cells)) {
      const { r, c } = refParts(ref)
      const rows = [...sheetData.getElementsByTagNameNS(MAIN, 'row')]
      let row = rows.find((x) => Number(x.getAttribute('r')) === r)
      if (!row) {
        row = d.createElementNS(MAIN, 'row')
        row.setAttribute('r', String(r))
        sheetData.insertBefore(row, rows.find((x) => Number(x.getAttribute('r')) > r) ?? null)
      }
      const cellsInRow = [...row.getElementsByTagNameNS(MAIN, 'c')]
      let cell = cellsInRow.find((x) => x.getAttribute('r') === ref)
      if (!cell) {
        cell = d.createElementNS(MAIN, 'c')
        cell.setAttribute('r', ref)
        row.insertBefore(cell, cellsInRow.find((x) => refParts(x.getAttribute('r')!).c > c) ?? null)
      }
      writeCell(d, cell, spec)
    }
  }

  /** Hapus tautan ke workbook lain dan calcChain; Excel menghitung ulang saat dibuka. */
  async cleanup() {
    const wb = await this.doc('xl/workbook.xml')
    const rels = await this.doc('xl/_rels/workbook.xml.rels')
    const types = await this.doc('[Content_Types].xml')
    for (const ext of [...wb.getElementsByTagNameNS(MAIN, 'externalReferences')]) ext.remove()
    for (const rel of [...rels.getElementsByTagNameNS(PKG, 'Relationship')]) {
      const type = rel.getAttribute('Type') ?? ''
      if (type.endsWith('/externalLink') || type.endsWith('/calcChain')) {
        const target = `xl/${rel.getAttribute('Target')}`
        this.zip.remove(target)
        this.zip.remove(target.replace(/([^/]+)$/, '_rels/$1.rels'))
        rel.remove()
        removeOverride(types, `/${target}`)
      }
    }
    const calc = wb.getElementsByTagNameNS(MAIN, 'calcPr')[0]
    calc?.setAttribute('fullCalcOnLoad', '1')
    // docProps/app.xml menyimpan daftar sheet lama; versi ringkas tetap valid.
    this.zip.file(
      'docProps/app.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application></Properties>',
    )
  }

  async removeSheet(name: string) {
    const wb = await this.doc('xl/workbook.xml')
    const rels = await this.doc('xl/_rels/workbook.xml.rels')
    const types = await this.doc('[Content_Types].xml')
    const sheets = [...wb.getElementsByTagNameNS(MAIN, 'sheet')]
    const idx = sheets.findIndex((s) => s.getAttribute('name') === name)
    if (idx < 0) return
    const path = await this.sheetPath(name)
    const rid = sheets[idx].getAttributeNS(REL, 'id')
    sheets[idx].remove()
    ;[...rels.getElementsByTagNameNS(PKG, 'Relationship')].find((r) => r.getAttribute('Id') === rid)?.remove()
    removeOverride(types, `/${path}`)
    // Drawing milik sheet ini ikut dihapus.
    const relPath = path.replace(/([^/]+)$/, '_rels/$1.rels')
    const sheetRels = this.zip.file(relPath) ? await this.doc(relPath) : null
    for (const rel of sheetRels ? [...sheetRels.getElementsByTagNameNS(PKG, 'Relationship')] : []) {
      if ((rel.getAttribute('Type') ?? '').endsWith('/drawing')) {
        const target = resolve(path, rel.getAttribute('Target')!)
        this.zip.remove(target)
        this.zip.remove(target.replace(/([^/]+)$/, '_rels/$1.rels'))
        removeOverride(types, `/${target}`)
      }
    }
    this.zip.remove(path)
    this.zip.remove(relPath)
    this.docs.delete(path)
    this.docs.delete(relPath)
    // Nama terdefinisi (Print_Area) memakai indeks sheet.
    for (const dn of [...wb.getElementsByTagNameNS(MAIN, 'definedName')]) {
      const local = dn.getAttribute('localSheetId')
      if (local === null) continue
      const n = Number(local)
      if (n === idx) dn.remove()
      else if (n > idx) dn.setAttribute('localSheetId', String(n - 1))
    }
    const dns = wb.getElementsByTagNameNS(MAIN, 'definedNames')[0]
    if (dns && !dns.children.length) dns.remove()
    wb.getElementsByTagNameNS(MAIN, 'workbookView')[0]?.setAttribute('activeTab', '0')
  }

  /** Salin sheet (beserta drawing/logo) ke tab baru di akhir. */
  async cloneSheet(srcName: string, newName: string) {
    const wb = await this.doc('xl/workbook.xml')
    const rels = await this.doc('xl/_rels/workbook.xml.rels')
    const types = await this.doc('[Content_Types].xml')
    const srcPath = await this.sheetPath(srcName)
    const n = nextIndex(this.zip, /^xl\/worksheets\/sheet(\d+)\.xml$/)
    const newPath = `xl/worksheets/sheet${n}.xml`
    const srcDoc = await this.doc(srcPath)
    const copy = new DOMParser().parseFromString(new XMLSerializer().serializeToString(srcDoc), 'application/xml')
    copy.getElementsByTagNameNS(MAIN, 'sheetView')[0]?.removeAttribute('tabSelected')
    this.docs.set(newPath, copy)
    this.zip.file(newPath, '')

    const srcRelPath = srcPath.replace(/([^/]+)$/, '_rels/$1.rels')
    if (this.zip.file(srcRelPath)) {
      const srcRels = await this.doc(srcRelPath)
      const relCopy = new DOMParser().parseFromString(new XMLSerializer().serializeToString(srcRels), 'application/xml')
      for (const rel of [...relCopy.getElementsByTagNameNS(PKG, 'Relationship')]) {
        if (!(rel.getAttribute('Type') ?? '').endsWith('/drawing')) continue
        const srcDrawing = resolve(srcPath, rel.getAttribute('Target')!)
        const dn = nextIndex(this.zip, /^xl\/drawings\/drawing(\d+)\.xml$/)
        const newDrawing = `xl/drawings/drawing${dn}.xml`
        this.zip.file(newDrawing, await this.zip.file(srcDrawing)!.async('uint8array'))
        const drRels = srcDrawing.replace(/([^/]+)$/, '_rels/$1.rels')
        if (this.zip.file(drRels)) this.zip.file(newDrawing.replace(/([^/]+)$/, '_rels/$1.rels'), await this.zip.file(drRels)!.async('uint8array'))
        rel.setAttribute('Target', `../drawings/drawing${dn}.xml`)
        addOverride(types, `/${newDrawing}`, DRAWING_CT)
      }
      const newRel = newPath.replace(/([^/]+)$/, '_rels/$1.rels')
      this.docs.set(newRel, relCopy)
      this.zip.file(newRel, '')
    }

    const rid = `rId${Math.max(0, ...[...rels.getElementsByTagNameNS(PKG, 'Relationship')].map((r) => Number((r.getAttribute('Id') ?? '').replace(/\D/g, '')) || 0)) + 1}`
    const rel = rels.createElementNS(PKG, 'Relationship')
    rel.setAttribute('Id', rid)
    rel.setAttribute('Type', `${REL}/worksheet`)
    rel.setAttribute('Target', `worksheets/sheet${n}.xml`)
    rels.documentElement.appendChild(rel)
    addOverride(types, `/${newPath}`, SHEET_CT)

    const sheetsEl = wb.getElementsByTagNameNS(MAIN, 'sheets')[0]
    const sheetEls = [...sheetsEl.getElementsByTagNameNS(MAIN, 'sheet')]
    const el = wb.createElementNS(MAIN, 'sheet')
    el.setAttribute('name', newName)
    el.setAttribute('sheetId', String(Math.max(...sheetEls.map((s) => Number(s.getAttribute('sheetId')))) + 1))
    el.setAttributeNS(REL, 'r:id', rid)
    sheetsEl.appendChild(el)

    // Area cetak ikut disalin.
    const srcIdx = sheetEls.findIndex((s) => s.getAttribute('name') === srcName)
    const pa = [...wb.getElementsByTagNameNS(MAIN, 'definedName')].find((d) => d.getAttribute('localSheetId') === String(srcIdx) && d.getAttribute('name') === '_xlnm.Print_Area')
    if (pa) {
      const copyPa = pa.cloneNode(true) as Element
      copyPa.setAttribute('localSheetId', String(sheetEls.length))
      copyPa.textContent = (pa.textContent ?? '').replace(/^'?[^!]+'?!/, `'${newName.replace(/'/g, "''")}'!`)
      pa.parentNode!.appendChild(copyPa)
    }
    return newPath
  }

  /** Tempel gambar PNG (tanda tangan) ke sheet tanpa drawing. */
  async addImages(sheetPath: string, images: ImageSpec[]) {
    if (!images.length) return
    const types = await this.doc('[Content_Types].xml')
    const dn = nextIndex(this.zip, /^xl\/drawings\/drawing(\d+)\.xml$/)
    const drawingPath = `xl/drawings/drawing${dn}.xml`
    const anchors: string[] = []
    const drRels: string[] = []
    images.forEach((img, i) => {
      const mn = nextIndex(this.zip, /^xl\/media\/image(\d+)\.\w+$/)
      this.zip.file(`xl/media/image${mn}.png`, img.png)
      drRels.push(`<Relationship Id="rId${i + 1}" Type="${REL}/image" Target="../media/image${mn}.png"/>`)
      anchors.push(
        `<xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>${px2emu(img.colOffPx)}</xdr:colOff><xdr:row>${img.row}</xdr:row><xdr:rowOff>${px2emu(img.rowOffPx)}</xdr:rowOff></xdr:from>` +
          `<xdr:ext cx="${px2emu(img.widthPx)}" cy="${px2emu(img.heightPx)}"/>` +
          `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="${escapeXml(img.name)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
          `<xdr:blipFill><a:blip xmlns:r="${REL}" r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
          `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${px2emu(img.widthPx)}" cy="${px2emu(img.heightPx)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`,
      )
    })
    this.zip.file(
      drawingPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`,
    )
    this.zip.file(
      drawingPath.replace(/([^/]+)$/, '_rels/$1.rels'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG}">${drRels.join('')}</Relationships>`,
    )
    addOverride(types, `/${drawingPath}`, DRAWING_CT)

    const relPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels')
    let sheetRels: Document
    if (this.zip.file(relPath)) sheetRels = await this.doc(relPath)
    else {
      sheetRels = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG}"/>`, 'application/xml')
      this.docs.set(relPath, sheetRels)
      this.zip.file(relPath, '')
    }
    const rid = `rId${sheetRels.getElementsByTagNameNS(PKG, 'Relationship').length + 10}`
    const rel = sheetRels.createElementNS(PKG, 'Relationship')
    rel.setAttribute('Id', rid)
    rel.setAttribute('Type', `${REL}/drawing`)
    rel.setAttribute('Target', `../drawings/drawing${dn}.xml`)
    sheetRels.documentElement.appendChild(rel)

    const d = await this.doc(sheetPath)
    const drawing = d.createElementNS(MAIN, 'drawing')
    drawing.setAttributeNS(REL, 'r:id', rid)
    // Urutan elemen worksheet: drawing setelah pageMargins/pageSetup/headerFooter/breaks.
    const after = ['pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags']
    const root = d.documentElement
    let anchor: Element | null = null
    for (const child of [...root.children]) if (after.includes(child.localName)) anchor = child
    root.insertBefore(drawing, anchor ? anchor.nextSibling : null)
  }

  /** Ubah langsung atribut sebuah elemen sheet (mis. pengaturan cetak). */
  async editSheet(sheetPath: string, fn: (doc: Document) => void) {
    fn(await this.doc(sheetPath))
  }

  async toBlob() {
    for (const [path, d] of this.docs) this.zip.file(path, new XMLSerializer().serializeToString(d))
    // JSZip menambah entri folder untuk path baru; paket Excel cukup berisi file.
    for (const [name, entry] of Object.entries(this.zip.files)) if (entry.dir) delete this.zip.files[name]
    return this.zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' })
  }
}

function writeCell(d: Document, cell: Element, spec: CellSpec) {
  const existingF = cell.getElementsByTagNameNS(MAIN, 'f')[0] ?? null
  for (const child of [...cell.children]) if (child.localName !== 'f') child.remove()
  cell.removeAttribute('t')
  let f: Element | null = existingF
  if (spec.formula === null && f) {
    f.remove()
    f = null
  } else if (typeof spec.formula === 'string') {
    if (!f) {
      f = d.createElementNS(MAIN, 'f')
      cell.insertBefore(f, cell.firstChild)
    }
    for (const a of [...f.attributes]) f.removeAttribute(a.name)
    f.textContent = spec.formula
  }
  const v = spec.value instanceof Date ? dateToSerial(spec.value) : spec.value
  if (v === null || v === undefined || v === '') return
  if (typeof v === 'number') {
    const el = d.createElementNS(MAIN, 'v')
    el.textContent = String(v)
    cell.appendChild(el)
  } else if (f) {
    cell.setAttribute('t', 'str')
    const el = d.createElementNS(MAIN, 'v')
    el.textContent = v
    cell.appendChild(el)
  } else {
    cell.setAttribute('t', 'inlineStr')
    const is = d.createElementNS(MAIN, 'is')
    const t = d.createElementNS(MAIN, 't')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = v
    is.appendChild(t)
    cell.appendChild(is)
  }
}

function removeOverride(types: Document, part: string) {
  ;[...types.getElementsByTagNameNS(CT, 'Override')].find((o) => o.getAttribute('PartName') === part)?.remove()
}

function addOverride(types: Document, part: string, contentType: string) {
  const o = types.createElementNS(CT, 'Override')
  o.setAttribute('PartName', part)
  o.setAttribute('ContentType', contentType)
  types.documentElement.appendChild(o)
}

function nextIndex(zip: JSZip, re: RegExp) {
  let max = 0
  zip.forEach((path) => {
    const m = path.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return max + 1
}

/** Path relatif "../drawings/x.xml" dari part `base` menjadi path zip. */
function resolve(base: string, target: string) {
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)
}

export async function dataUrlToBytes(dataUrl: string) {
  return new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
}
