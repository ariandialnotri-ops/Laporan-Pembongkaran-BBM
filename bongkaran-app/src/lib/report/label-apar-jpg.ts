/**
 * Label QR APAR/APAB sebagai gambar JPG (300 dpi), tampilan sama dengan PDF label (label-apar.ts):
 * per label 92 x 66 mm, atau lembar A4 berisi 8 label (2 kolom x 4 baris). Satu file diunduh
 * langsung sebagai .jpg; lebih dari satu dibungkus ZIP.
 */
import QRCode from 'qrcode'
import { aparUnitUrl, jenisLengkap, tipeLabel, warnaLabel, type AparTipe, type AparUnit } from '@/lib/apar'

export type LabelApar = { u: AparUnit; tipe: AparTipe }

// Ukuran (mm) sama dengan PDF label.
const A4 = { w: 210, h: 297 }
const KOLOM = 2
const BARIS = 4
const LW = 92
const LH = 66
const GX = (A4.w - KOLOM * LW) / (KOLOM + 1)
const GY = (A4.h - BARIS * LH) / (BARIS + 1)
const KEPALA = 9
const QR = 44
const PAD = 3
/** 1 pt dalam mm. */
const PT = 25.4 / 72
/** Piksel per mm pada 300 dpi. */
const PX = 300 / 25.4
const HURUF = 'Helvetica, Arial, sans-serif'

function muatGambar(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal membuat QR'))
    img.src = src
  })
}

const huruf = (ctx: CanvasRenderingContext2D, pt: number, tebal: boolean) => (ctx.font = `${tebal ? 'bold ' : ''}${pt * PT}px ${HURUF}`)

/** Ukuran huruf terbesar (pt) agar teks satu baris muat di lebar mm. */
function pasFont(ctx: CanvasRenderingContext2D, teks: string, lebar: number, maks: number, min: number, tebal = true) {
  for (let fs = maks; fs > min; fs -= 0.5) {
    huruf(ctx, fs, tebal)
    if (ctx.measureText(teks).width <= lebar) return fs
  }
  huruf(ctx, min, tebal)
  return min
}

/** Pecah teks per kata agar tiap baris muat di lebar (huruf aktif). */
function pecah(ctx: CanvasRenderingContext2D, teks: string, lebar: number) {
  const out: string[] = []
  let baris = ''
  for (const kata of teks.split(/\s+/).filter(Boolean)) {
    const coba = baris ? `${baris} ${kata}` : kata
    if (ctx.measureText(coba).width <= lebar || !baris) baris = coba
    else {
      out.push(baris)
      baris = kata
    }
  }
  if (baris) out.push(baris)
  return out.length ? out : ['-']
}

function kotakBulat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Gambar satu label di (x, y) mm; konteks sudah diskalakan ke satuan mm. */
function gambarLabel(ctx: CanvasRenderingContext2D, x: number, y: number, { u, tipe }: LabelApar, nama: string, qr: HTMLImageElement) {
  const warna = warnaLabel(tipe, u.cadangan)
  ctx.save()
  kotakBulat(ctx, x, y, LW, LH, 3)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, LW, LH)
  ctx.fillStyle = warna
  ctx.fillRect(x, y, LW, KEPALA)
  ctx.restore()
  kotakBulat(ctx, x, y, LW, LH, 3)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Nama SPBU: satu baris, mengecil bila panjang; dua baris bila tetap tidak muat.
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  const lebarKepala = LW - 2 * PAD
  const fsKepala = pasFont(ctx, nama, lebarKepala, 10, 7)
  let barisKepala = [nama]
  if (fsKepala <= 7) {
    huruf(ctx, 6.5, true)
    barisKepala = pecah(ctx, nama, lebarKepala).slice(0, 2)
  }
  const tinggiKepala = (fsKepala <= 7 ? 6.5 : fsKepala) * PT * 1.1
  const yKepala = y + KEPALA / 2 - ((barisKepala.length - 1) * tinggiKepala) / 2
  barisKepala.forEach((t, k) => ctx.fillText(t, x + PAD, yKepala + k * tinggiKepala))

  // QR di kiri (tanpa penghalusan supaya modul QR tetap tajam).
  const badanY = y + KEPALA
  const badanH = LH - KEPALA
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, x + PAD, badanY + (badanH - QR) / 2, QR, QR)
  ctx.imageSmoothingEnabled = true

  // Teks di kanan QR.
  const tx = x + PAD + QR + PAD
  const tw = x + LW - PAD - tx
  ctx.textBaseline = 'top'
  const kode = u.kode || '-'
  const fsKode = pasFont(ctx, kode, tw, 22, 11)
  const kodeBaris = pecah(ctx, kode, tw).slice(0, 2)
  const hKode = kodeBaris.length * fsKode * PT * 1.05

  const badge = tipeLabel(tipe, u.cadangan).toUpperCase()
  const fsBadge = pasFont(ctx, badge, tw - 2, 8, 6)
  const lebarBadge = Math.min(tw, ctx.measureText(badge).width + 2.4)
  const hBadge = fsBadge * PT + 2

  const lh = 8.5 * PT * 1.2
  huruf(ctx, 8.5, true)
  const detail = pecah(ctx, `${jenisLengkap(u)}, ${u.kapasitasKg || '-'} kg`, tw).slice(0, 3)
  huruf(ctx, 8.5, false)
  const lokasi = pecah(ctx, u.lokasi || '-', tw).slice(0, 2)
  const total = hKode + 2 + hBadge + 2 + detail.length * lh + 1.5 + lokasi.length * lh
  let ty = badanY + Math.max(2, (badanH - total) / 2)

  ctx.fillStyle = '#000000'
  huruf(ctx, fsKode, true)
  for (const t of kodeBaris) {
    ctx.fillText(t, tx, ty)
    ty += fsKode * PT * 1.05
  }
  ty += 2

  ctx.strokeStyle = warna
  ctx.lineWidth = 0.4
  kotakBulat(ctx, tx, ty, lebarBadge, hBadge, 0.8)
  ctx.stroke()
  ctx.fillStyle = warna
  ctx.textBaseline = 'middle'
  huruf(ctx, fsBadge, true)
  ctx.fillText(badge, tx + 1.2, ty + hBadge / 2)
  ty += hBadge + 2

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000000'
  huruf(ctx, 8.5, true)
  for (const t of detail) {
    ctx.fillText(t, tx, ty)
    ty += lh
  }
  ty += 1.5
  huruf(ctx, 8.5, false)
  for (const t of lokasi) {
    ctx.fillText(t, tx, ty)
    ty += lh
  }
}

function kanvas(wMm: number, hMm: number) {
  const c = document.createElement('canvas')
  c.width = Math.round(wMm * PX)
  c.height = Math.round(hMm * PX)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak tersedia di perangkat ini')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(PX, PX)
  return { c, ctx }
}

/** JPG dengan resolusi 300 dpi tercatat di kepala JFIF, supaya ukuran cetaknya tepat (92 x 66 mm / A4). */
async function keJpg(c: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat JPG'))), 'image/jpeg', 0.95))
  const buf = new Uint8Array(await blob.arrayBuffer())
  // SOI, APP0 "JFIF\0": byte 13 = satuan (1 = dpi), 14-17 = kerapatan X & Y.
  if (buf[2] === 0xff && buf[3] === 0xe0 && String.fromCharCode(...buf.slice(6, 10)) === 'JFIF') {
    buf[13] = 1
    buf[14] = buf[16] = 300 >> 8
    buf[15] = buf[17] = 300 & 0xff
  }
  return new Blob([buf], { type: 'image/jpeg' })
}

const amanNama = (s: string) => s.replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '') || 'label'

function unduh(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Unduh label sebagai JPG. `mode` = 'label' (satu gambar per label) atau 'a4' (8 label per lembar).
 * `dasar` = awalan nama file. Mengembalikan jumlah gambar yang dibuat.
 */
export async function exportLabelAparJpg(labels: LabelApar[], namaSpbu: string, mode: 'label' | 'a4', dasar: string) {
  if (!labels.length) return 0
  await document.fonts?.ready
  const nama = (namaSpbu || 'SPBU').toUpperCase()
  const qr = await Promise.all(labels.map(({ u }) => QRCode.toDataURL(aparUnitUrl(u.id), { margin: 1, width: 600, errorCorrectionLevel: 'M' }).then(muatGambar)))
  const file: { nama: string; blob: Blob }[] = []

  if (mode === 'label') {
    // Margin putih 2 mm di sekeliling label sebagai batas potong.
    const M = 2
    for (const [i, l] of labels.entries()) {
      const { c, ctx } = kanvas(LW + M * 2, LH + M * 2)
      gambarLabel(ctx, M, M, l, nama, qr[i])
      file.push({ nama: `${dasar}_${amanNama(l.u.kode || l.u.id)}.jpg`, blob: await keJpg(c) })
    }
  } else {
    const perLembar = KOLOM * BARIS
    const lembar = Math.ceil(labels.length / perLembar)
    for (let p = 0; p < lembar; p++) {
      const { c, ctx } = kanvas(A4.w, A4.h)
      labels.slice(p * perLembar, (p + 1) * perLembar).forEach((l, n) => {
        const x = GX + (n % KOLOM) * (LW + GX)
        const y = GY + Math.floor(n / KOLOM) * (LH + GY)
        gambarLabel(ctx, x, y, l, nama, qr[p * perLembar + n])
      })
      file.push({ nama: `${dasar}_A4${lembar > 1 ? `_${p + 1}` : ''}.jpg`, blob: await keJpg(c) })
    }
  }

  if (file.length === 1) unduh(file[0].blob, file[0].nama)
  else {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const f of file) zip.file(f.nama, f.blob)
    unduh(await zip.generateAsync({ type: 'blob' }), `${dasar}_${mode === 'a4' ? 'A4' : 'per_label'}_JPG.zip`)
  }
  return file.length
}
