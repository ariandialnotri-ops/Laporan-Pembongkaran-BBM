/**
 * Menggambar satu sheet template Excel ke <canvas> dengan lebar kolom,
 * tinggi baris, sel gabungan, garis, isi warna, font, dan format angka yang
 * sama seperti template. Dipakai untuk PDF/JPG. File Excel sendiri diisi
 * langsung dari template aslinya (xlsx.ts).
 *
 * Calibri/Arial diganti Carlito/Arimo (ukuran huruf identik) agar hasil sama
 * di semua HP.
 */
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/700.css'
import '@fontsource/carlito/400.css'
import '@fontsource/carlito/700.css'
import layouts from '@/data/report-templates.json'
import { formatCell, type CellValue } from './numfmt'

export type SheetKey = keyof typeof layouts

interface Style {
  ff: string
  sz: number
  b: boolean
  i: boolean
  u: boolean
  c: string
  bg: string | null
  h: string
  v: string
  w: boolean
  ind: number
  fmt: string
  bt?: string
  bb?: string
  bl?: string
  br?: string
}
interface Cell {
  s?: number
  v?: string | number
  f?: string
  span?: [number, number]
}
interface Layout {
  area: { c1: number; r1: number; c2: number; r2: number }
  cols: number[]
  rows: number[]
  cells: Record<string, Cell>
  styles: Style[]
  images: { src: string; x: number; y: number; w: number; h: number }[]
}

/** Gambar di atas area sel (mis. tanda tangan): `from`/`to` = sel kiri atas & kanan bawah. */
export interface Overlay {
  from: string
  to: string
  src: string
  /** Lebar kotak (px template), di tengah area `from`-`to`; boleh melewati kolom. */
  w?: number
}

const FONT: Record<string, string> = { Calibri: 'Carlito, Calibri, sans-serif', Arial: 'Arimo, Arial, sans-serif' }

export const colIndex = (letters: string) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
export const colLetter = (n: number) => {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
export const parseRef = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/)!
  return { c: colIndex(m[1]), r: Number(m[2]) }
}

export function getLayout(key: SheetKey) {
  return layouts[key] as unknown as Layout
}

/** Kotak gambar (px template) untuk area sel: lebar `w` di tengah kolom area, tinggi baris area. */
export function overlayBox(key: SheetKey, o: Pick<Overlay, 'from' | 'to' | 'w'>) {
  const l = getLayout(key)
  const a = parseRef(o.from)
  const z = parseRef(o.to)
  const xs = (c: number) => l.cols.slice(0, c - l.area.c1).reduce((s, v) => s + v, 0)
  const ys = (r: number) => l.rows.slice(0, r - l.area.r1).reduce((s, v) => s + v, 0)
  const left = xs(a.c)
  const right = xs(z.c + 1)
  const w = o.w ?? right - left - 8
  return { x: (left + right) / 2 - w / 2, y: ys(a.r) + 2, w, h: ys(z.r + 1) - ys(a.r) - 4 }
}

export function sheetSize(key: SheetKey) {
  const l = getLayout(key)
  return { width: l.cols.reduce((a, b) => a + b, 0), height: l.rows.reduce((a, b) => a + b, 0) }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function ensureFonts() {
  await Promise.all(
    ['400 15px Carlito', '700 15px Carlito', '400 15px Arimo', '700 15px Arimo'].map((f) => document.fonts.load(f).catch(() => [])),
  )
}

/** "1px solid #000000" -> garis canvas. */
function strokeSide(ctx: CanvasRenderingContext2D, spec: string, x1: number, y1: number, x2: number, y2: number) {
  const [w, kind, color] = spec.split(' ')
  const width = parseFloat(w)
  ctx.save()
  ctx.strokeStyle = color ?? '#000000'
  ctx.setLineDash(kind === 'dotted' ? [1, 2] : kind === 'dashed' ? [4, 2] : [])
  const horizontal = y1 === y2
  const draw = (off: number, lw: number) => {
    ctx.lineWidth = lw
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(x1, y1 + off)
      ctx.lineTo(x2, y2 + off)
    } else {
      ctx.moveTo(x1 + off, y1)
      ctx.lineTo(x2 + off, y2)
    }
    ctx.stroke()
  }
  if (kind === 'double') {
    draw(-1, 1)
    draw(1, 1)
  } else draw(0, width)
  ctx.restore()
}

export async function drawSheet(sheet: SheetKey, values: Record<string, CellValue>, opts: { red?: string[]; overlays?: Overlay[]; scale?: number; formats?: Record<string, string> } = {}) {
  const { red = [], overlays = [], scale = 2, formats = {} } = opts
  const l = getLayout(sheet)
  const { c1, r1, c2, r2 } = l.area
  const { width, height } = sheetSize(sheet)
  const xs = [0]
  l.cols.forEach((w) => xs.push(xs[xs.length - 1] + w))
  const ys = [0]
  l.rows.forEach((h) => ys.push(ys[ys.length - 1] + h))
  const X = (c: number) => xs[c - c1]
  const Y = (r: number) => ys[r - r1]

  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const valueOf = (ref: string): CellValue => {
    if (ref in values) return values[ref]
    const cell = l.cells[ref]
    if (!cell || cell.f) return null
    return cell.v ?? null
  }
  const covered = new Set<string>()
  for (const [ref, cell] of Object.entries(l.cells)) {
    if (!cell.span) continue
    const { c, r } = parseRef(ref)
    for (let rr = r; rr < r + cell.span[0]; rr++) for (let cc = c; cc < c + cell.span[1]; cc++) if (rr !== r || cc !== c) covered.add(`${colLetter(cc)}${rr}`)
  }
  const filled = (c: number, r: number) => {
    if (c < c1 || c > c2) return true
    const ref = `${colLetter(c)}${r}`
    if (covered.has(ref)) return true
    const v = valueOf(ref)
    return v !== null && v !== ''
  }

  type Box = { ref: string; c: number; r: number; x: number; y: number; w: number; h: number; st: Style | null; span: [number, number] }
  const boxes: Box[] = []
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const ref = `${colLetter(c)}${r}`
      if (covered.has(ref)) continue
      const cell = l.cells[ref]
      const span = cell?.span ?? [1, 1]
      boxes.push({ ref, c, r, x: X(c), y: Y(r), w: X(c + span[1]) - X(c), h: Y(r + span[0]) - Y(r), st: cell?.s !== undefined ? l.styles[cell.s] : null, span })
    }

  // 1. Isi warna sel
  for (const b of boxes)
    if (b.st?.bg) {
      ctx.fillStyle = b.st.bg
      ctx.fillRect(b.x, b.y, b.w, b.h)
    }

  // 2. Teks
  ctx.textBaseline = 'alphabetic'
  for (const b of boxes) {
    const v = valueOf(b.ref)
    if (v === null || v === '') continue
    const st = b.st
    const { text, align } = formatCell(v, formats[b.ref] ?? st?.fmt ?? 'General')
    if (!text) continue
    const px = ((st?.sz ?? 11) * 96) / 72
    ctx.font = `${st?.i ? 'italic ' : ''}${st?.b ? 700 : 400} ${px}px ${FONT[st?.ff ?? 'Calibri'] ?? st?.ff}`
    ctx.fillStyle = red.includes(b.ref) ? '#FF0000' : (st?.c ?? '#000000')
    const h = !st || st.h === 'general' ? align : st.h === 'centerContinuous' ? 'center' : st.h
    const pad = 2 + (st?.ind ?? 0) * 9
    const rightPad = /_[)-]/.test(st?.fmt ?? '') && typeof v === 'number' ? pad + 4 : pad
    const m = ctx.measureText('Hg')
    const ascent = m.fontBoundingBoxAscent ?? px * 0.8
    const descent = m.fontBoundingBoxDescent ?? px * 0.22
    const lines = st?.w ? wrap(ctx, text, b.w - pad * 2) : [text]
    const lh = ascent + descent
    const blockH = lh * lines.length
    let top = b.y + b.h - blockH - 1
    if (st?.v === 'center') top = b.y + (b.h - blockH) / 2
    else if (st?.v === 'top') top = b.y + 1

    // Teks tanpa wrap meluber ke sel kosong di sebelahnya, seperti Excel.
    let clipL = b.x
    let clipR = b.x + b.w
    if (!st?.w) {
      if (h === 'left' || h === 'center') for (let c = b.c + b.span[1]; !filled(c, b.r); c++) clipR = X(c + 1)
      if (h === 'right' || h === 'center') for (let c = b.c - 1; !filled(c, b.r); c--) clipL = X(c)
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(clipL, b.y, clipR - clipL, b.h)
    ctx.clip()
    lines.forEach((line, i) => {
      const tw = ctx.measureText(line).width
      const x = h === 'right' ? b.x + b.w - rightPad - tw : h === 'center' ? b.x + (b.w - tw) / 2 : b.x + pad
      const base = top + ascent + i * lh
      ctx.fillText(line, x, base)
      if (st?.u) ctx.fillRect(x, base + Math.max(1, px * 0.08), tw, Math.max(1, px / 14))
    })
    ctx.restore()
  }

  // 3. Garis tepi
  for (const b of boxes) {
    const st = b.st
    if (!st) continue
    if (st.bt) strokeSide(ctx, st.bt, b.x, b.y, b.x + b.w, b.y)
    if (st.bb) strokeSide(ctx, st.bb, b.x, b.y + b.h, b.x + b.w, b.y + b.h)
    if (st.bl) strokeSide(ctx, st.bl, b.x, b.y, b.x, b.y + b.h)
    if (st.br) strokeSide(ctx, st.br, b.x + b.w, b.y, b.x + b.w, b.y + b.h)
  }

  // 4. Logo template dan gambar tambahan (tanda tangan)
  for (const img of l.images) {
    const el = await loadImage(img.src)
    if (el) ctx.drawImage(el, img.x, img.y, img.w, img.h)
  }
  for (const o of overlays) {
    const el = await loadImage(o.src)
    if (!el) continue
    const { x: ax, y: ay, w: aw, h: ah } = overlayBox(sheet, o)
    const s = Math.min(aw / el.naturalWidth, ah / el.naturalHeight)
    const w = el.naturalWidth * s
    const hh = el.naturalHeight * s
    ctx.drawImage(el, ax + (aw - w) / 2, ay + (ah - hh) / 2, w, hh)
  }
  return canvas
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && ctx.measureText(next).width > max) {
        out.push(line)
        line = word
      } else line = next
    }
    out.push(line)
  }
  return out
}
