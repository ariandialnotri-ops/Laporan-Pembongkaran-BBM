/**
 * Keluaran laporan sesuai template Excel referensi:
 * - Excel: file template asli diisi (lihat xlsx.ts)
 * - PDF/JPG: sheet yang sama digambar ulang (sheet-view.tsx) lalu dirender
 *   ke gambar; PDF Berita Acara ditambah lampiran foto evidence.
 */
import { jsPDF } from 'jspdf'
import { LEGACY_PHOTO_SLOTS, STEPS, type Derived, type Report, type Settings } from '@/lib/sop'
import { buildBa } from './ba'
import { paginate, persediaanCells, type PersediaanRow } from './persediaan'
import { trimSignature } from '@/lib/signature'
import { drawSheet, getLayout, overlayBox, type SheetKey } from './sheet-canvas'
import { dataUrlToBytes, Workbook, type CellSpec, type ImageSpec } from './xlsx'

const BA_SHEET = 'BERITA ACARA PEMBONGKARAN'
const PERSEDIAAN_SHEET = 'Catatan Persediaan BBM,'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const valuesOf = (cells: Record<string, CellSpec>) => Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.value]))

// ---------------------------------------------------------------- Excel

/** Posisi gambar dalam piksel -> kolom/baris + offset, memakai ukuran template. */
function anchorFor(sheet: SheetKey, area: { from: string; to: string; w?: number }, imgW: number, imgH: number): Omit<ImageSpec, 'png' | 'name'> {
  const l = getLayout(sheet)
  const box = overlayBox(sheet, area)
  const scale = Math.min(box.w / imgW, box.h / imgH)
  const w = imgW * scale
  const h = imgH * scale
  // Letakkan di tengah kotak; offset dihitung dari kolom/baris tempat sudut kiri atas jatuh.
  let x = box.x + (box.w - w) / 2
  let y = box.y + (box.h - h) / 2
  let col = l.area.c1
  while (col < l.area.c2 && x >= l.cols[col - l.area.c1]) x -= l.cols[col++ - l.area.c1]
  let row = l.area.r1
  while (row < l.area.r2 && y >= l.rows[row - l.area.r1]) y -= l.rows[row++ - l.area.r1]
  return { col: col - 1, colOffPx: x, row: row - 1, rowOffPx: y, widthPx: w, heightPx: h }
}

function imageSize(src: string) {
  return new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.onerror = () => resolve({ w: 3, h: 1 })
    img.src = src
  })
}

export async function exportBaXlsx(report: Report, x: Derived, settings: Settings, filename: string) {
  const ba = buildBa(report, x, settings)
  const wb = await Workbook.loadTemplate()
  await wb.removeSheet(PERSEDIAAN_SHEET)
  const path = await wb.sheetPath(BA_SHEET)
  await wb.setCells(path, ba.cells)
  const images: ImageSpec[] = []
  for (const s of ba.signatures) {
    const img = await trimSignature(s.img)
    const { w, h } = await imageSize(img)
    images.push({ ...anchorFor('ba', s, w, h), png: await dataUrlToBytes(img), name: `Tanda tangan ${s.key}` })
  }
  await wb.addImages(path, images)
  await wb.editSheet(path, (d) => {
    // Template tidak punya pengaturan cetak: cetak satu halaman A4.
    const NS = d.documentElement.namespaceURI!
    let pr = d.getElementsByTagNameNS(NS, 'sheetPr')[0]
    if (!pr) {
      pr = d.createElementNS(NS, 'sheetPr')
      d.documentElement.insertBefore(pr, d.documentElement.firstElementChild)
    }
    const ps = d.createElementNS(NS, 'pageSetUpPr')
    ps.setAttribute('fitToPage', '1')
    pr.appendChild(ps)
    const setup = d.createElementNS(NS, 'pageSetup')
    setup.setAttribute('paperSize', '9')
    setup.setAttribute('orientation', 'portrait')
    setup.setAttribute('fitToWidth', '1')
    setup.setAttribute('fitToHeight', '1')
    const margins = d.getElementsByTagNameNS(NS, 'pageMargins')[0]
    d.documentElement.insertBefore(setup, margins?.nextSibling ?? null)
    // Format bersyarat template merujuk K31 (kosong); batas toleransi ada di K30.
    for (const f of [...d.getElementsByTagNameNS(NS, 'formula')]) if (f.textContent === '$K$31') f.textContent = '$K$30'
  })
  await wb.cleanup()
  downloadBlob(await wb.toBlob(), filename)
}

export interface PersediaanExport {
  rows: PersediaanRow[]
  header: { noSpbu: string; produk: string; tangki: string }
}

export async function exportPersediaanXlsx(data: PersediaanExport, filename: string) {
  const pages = paginate(data.rows)
  const wb = await Workbook.loadTemplate()
  await wb.removeSheet(BA_SHEET)
  const paths = [await wb.sheetPath(PERSEDIAAN_SHEET)]
  for (let i = 1; i < pages.length; i++) paths.push(await wb.cloneSheet(PERSEDIAAN_SHEET, `Catatan Persediaan BBM (${i + 1})`))
  for (let i = 0; i < pages.length; i++) await wb.setCells(paths[i], persediaanCells(pages[i], data.header))
  await wb.cleanup()
  downloadBlob(await wb.toBlob(), filename)
}

// ---------------------------------------------------------------- PDF / JPG

async function baRender(report: Report, x: Derived, settings: Settings) {
  const ba = buildBa(report, x, settings)
  const overlays = await Promise.all(ba.signatures.map(async (s) => ({ from: s.from, to: s.to, w: s.w, src: await trimSignature(s.img) })))
  const formats = Object.fromEntries(Object.entries(ba.cells).flatMap(([k, v]) => (v.fmt ? [[k, v.fmt]] : [])))
  return drawSheet('ba', valuesOf(ba.cells), { red: ba.red, overlays, formats })
}

export async function exportBaJpg(report: Report, x: Derived, settings: Settings, filename: string) {
  const canvas = await baRender(report, x, settings)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/jpeg', 0.92)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Tempel canvas ke halaman PDF dengan margin, proporsional. */
function placeCanvas(doc: jsPDF, canvas: HTMLCanvasElement, margin = 24) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const scale = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height)
  const w = canvas.width * scale
  const h = canvas.height * scale
  doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - w) / 2, margin, w, h)
}

const BIRU: [number, number, number] = [21, 94, 168]
const jamFoto = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Lampiran foto evidence: dikelompokkan per tahap SOP (pita judul bernomor), foto mengalir dalam grid 4 kolom
 * berbingkai 3:4 (12 foto per halaman); kelompok kecil berbagi baris. Foto dimuat utuh sesuai rasio aslinya (tidak gepeng / tidak
 * terpotong), sisa bingkai berwarna abu muda. Tiap foto diberi keterangan slot dan jam pengambilan.
 */
function lampiranFoto(doc: jsPDF, report: Report, photoData: Record<string, string>) {
  const groups = STEPS.map((step, si) => ({
    no: si + 1,
    title: step.title,
    items: step.photos
      .flatMap((p) => [p, ...(LEGACY_PHOTO_SLOTS[p.key] ?? [])])
      .flatMap((p) => (report.photos[p.key] ?? []).map((ph) => ({ label: p.label, ph }))),
  })).filter((g) => g.items.length)
  if (!groups.length) return

  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const M = 28
  const KOLOM = 4
  const GAP = 8
  const cw = (pw - M * 2 - GAP * (KOLOM - 1)) / KOLOM
  const bh = cw * (4 / 3)
  const CAP = 20
  const rowH = bh + CAP + GAP + 4
  const bawah = ph - M - 14
  const d = report.data
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  let hal = 0
  let y = 0

  const halamanBaru = () => {
    doc.addPage('a4', 'portrait')
    hal++
    doc.setFillColor(...BIRU)
    doc.rect(0, 0, pw, 4, 'F')
    doc.setTextColor(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('LAMPIRAN FOTO EVIDENCE', M, M + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(90)
    const info = [d.noBA && `BA ${d.noBA}`, d.nopol && `MT ${d.nopol}`, d.produk, d.tanggalDatang].filter(Boolean).join('  ·  ')
    doc.text(info, M, M + 20)
    doc.text(`${total} foto`, pw - M, M + 8, { align: 'right' })
    doc.setDrawColor(220)
    doc.setLineWidth(0.5)
    doc.line(M, M + 27, pw - M, M + 27)
    doc.setFontSize(7)
    doc.setTextColor(130)
    doc.text(`Lampiran Berita Acara Pembongkaran BBM · hal. ${hal}`, pw / 2, ph - M + 6, { align: 'center' })
    y = M + 38
  }
  halamanBaru()

  // Kelompok dikemas berdampingan: tahap dengan 1-2 foto berbagi satu baris; kelompok yang tidak muat di
  // sisa kolom pindah ke baris baru. Tiap potongan kelompok diberi pita judul selebar fotonya.
  const HEAD = 18
  let col = 0
  const barisBaru = () => {
    y += HEAD + rowH
    col = 0
    if (y + HEAD + bh + CAP > bawah) halamanBaru()
  }
  const pita = (g: (typeof groups)[number], c0: number, n: number, lanjut: boolean) => {
    const x = M + c0 * (cw + GAP)
    const w = n * cw + (n - 1) * GAP
    doc.setFillColor(237, 243, 251)
    doc.roundedRect(x, y, w, 14, 3, 3, 'F')
    doc.setFillColor(...BIRU)
    doc.circle(x + 7, y + 7, 5, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(String(g.no), x + 7, y + 9.2, { align: 'center' })
    doc.setTextColor(...BIRU)
    doc.setFontSize(7.5)
    doc.text(doc.splitTextToSize(`${g.title}${lanjut ? ' (lanjutan)' : ''}`, w - 20)[0] as string, x + 16, y + 9.6)
  }
  for (const g of groups) {
    if (col > 0 && col + g.items.length > KOLOM) barisBaru()
    let mulai = 0
    while (mulai < g.items.length) {
      if (col >= KOLOM) barisBaru()
      const n = Math.min(KOLOM - col, g.items.length - mulai)
      pita(g, col, n, mulai > 0)
      for (let i = 0; i < n; i++) {
        const it = g.items[mulai + i]
        const x = M + (col + i) * (cw + GAP)
        const yy = y + HEAD
        doc.setFillColor(244, 245, 247)
        doc.roundedRect(x, yy, cw, bh, 3, 3, 'F')
        const src = photoData[it.ph.id] || it.ph.dataUrl || ''
        try {
          // Muat utuh sesuai rasio asli: tidak gepeng, tidak terpotong.
          const prop = doc.getImageProperties(src)
          const k = Math.min(cw / prop.width, bh / prop.height)
          const w = prop.width * k
          const h = prop.height * k
          doc.addImage(src, 'JPEG', x + (cw - w) / 2, yy + (bh - h) / 2, w, h)
        } catch {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(150)
          doc.text('(gambar tidak dapat dimuat)', x + cw / 2, yy + bh / 2, { align: 'center' })
        }
        doc.setDrawColor(215)
        doc.setLineWidth(0.4)
        doc.roundedRect(x, yy, cw, bh, 3, 3, 'S')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.8)
        doc.setTextColor(40)
        doc.text(doc.splitTextToSize(it.label, cw)[0] as string, x, yy + bh + 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.3)
        doc.setTextColor(120)
        doc.text(jamFoto(it.ph.at), x, yy + bh + 15.5)
      }
      col += n
      mulai += n
    }
  }
  doc.setTextColor(0)
}

/** Jenis unduhan BA. `pdf-ba`: PDF tanpa lampiran foto (cepat). */
export type ExportKind = 'pdf' | 'pdf-ba' | 'jpg' | 'xlsx'

/** PDF Berita Acara; `photoData` null = tanpa lampiran foto evidence. */
export async function exportBaPdf(report: Report, x: Derived, settings: Settings, photoData: Record<string, string> | null, filename: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  placeCanvas(doc, await baRender(report, x, settings))
  if (!photoData) {
    doc.save(filename)
    return
  }

  lampiranFoto(doc, report, photoData)
  doc.save(filename)
}

export async function exportPersediaanPdf(data: PersediaanExport, filename: string) {
  // Template: kertas Legal landscape.
  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' })
  const pages = paginate(data.rows)
  for (let i = 0; i < pages.length; i++) {
    if (i) doc.addPage()
    placeCanvas(doc, await drawSheet('persediaan', valuesOf(persediaanCells(pages[i], data.header))), 18)
  }
  doc.save(filename)
}
