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

  // Lampiran foto evidence per tahap.
  const groups = STEPS.flatMap((step, si) =>
    step.photos.flatMap((p) => [p, ...(LEGACY_PHOTO_SLOTS[p.key] ?? [])])
      .filter((p) => (report.photos[p.key] ?? []).length)
      .map((p) => ({ title: `Tahap ${si + 1} - ${step.title}: ${p.label}`, photos: report.photos[p.key] })),
  )
  if (groups.length) {
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const margin = 36
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('LAMPIRAN FOTO EVIDENCE', margin, 44)
    let y = 64
    const imgW = 250
    const imgH = 170
    const gap = pw - margin * 2 - imgW * 2
    for (const g of groups) {
      if (y + 16 + imgH > ph - 36) {
        doc.addPage()
        y = 44
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(g.title, margin, y)
      y += 6
      let col = 0
      for (const p of g.photos) {
        if (col === 0 && y + imgH > ph - 36) {
          doc.addPage()
          y = 44
        }
        const px = margin + col * (imgW + gap)
        try {
          doc.addImage(photoData[p.id] || p.dataUrl || '', 'JPEG', px, y, imgW, imgH)
        } catch {
          doc.setFont('helvetica', 'normal')
          doc.text('(gambar tidak dapat dimuat)', px, y + imgH / 2)
        }
        col++
        if (col > 1) {
          col = 0
          y += imgH + 8
        }
      }
      if (col !== 0) y += imgH + 8
      y += 10
    }
  }
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
