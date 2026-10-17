/**
 * Kolase foto sampling Guard Tour: tiga foto dalam satu gambar dengan garis putih tipis.
 * Kiri atas EDC, kiri bawah struk, kanan (setinggi gambar) kendaraan. Tiap bagian diberi cap
 * sendiri (jam pengambilan, SPBU, keterangan) supaya cap tidak terpotong saat foto dipangkas.
 */
export interface BagianKolase {
  blob: Blob
  /** Baris cap: baris pertama (tebal, kuning) biasanya tanggal & jam pengambilan. */
  cap: string[]
}

const LEBAR = 1600
const TINGGI = 1200
/** Tebal garis putih (luar & antarfoto). */
const GARIS = 6
const HURUF = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

async function muat(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Gambar memenuhi kotak (dipangkas di tengah, tanpa mengubah perbandingan sisi). */
function penuhi(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** Tingkat buram latar kotak yang tidak penuh foto: 95% (foto diperkecil ke 5% lalu diperbesar). */
const BURAM = 0.95

/**
 * Latar buram dari foto itu sendiri. Diperkecil bertahap ke 5% lalu diperbesar dengan penghalusan
 * (tanpa ctx.filter, yang belum didukung semua Safari iPhone).
 */
function latarBuram(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const kanvas = (cw: number, ch: number) => {
    const c = document.createElement('canvas')
    c.width = Math.max(2, Math.round(cw))
    c.height = Math.max(2, Math.round(ch))
    const k = c.getContext('2d')!
    k.imageSmoothingEnabled = true
    k.imageSmoothingQuality = 'high'
    return { c, k }
  }
  const sisa = 1 - BURAM
  const tengah = kanvas(w * 0.15, h * 0.15)
  const kecil = kanvas(w * sisa * 0.5, h * sisa * 0.5)
  penuhi(tengah.k, img, 0, 0, tengah.c.width, tengah.c.height)
  // Dua putaran kecil-besar: detail (tulisan struk) hilang, warna tetap.
  for (let i = 0; i < 2; i++) {
    kecil.k.clearRect(0, 0, kecil.c.width, kecil.c.height)
    kecil.k.drawImage(tengah.c, 0, 0, kecil.c.width, kecil.c.height)
    tengah.k.clearRect(0, 0, tengah.c.width, tengah.c.height)
    tengah.k.drawImage(kecil.c, 0, 0, tengah.c.width, tengah.c.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tengah.c, x, y, w, h)
  kecil.c.width = 0
  tengah.c.width = 0
}

/**
 * Letakkan foto di kotak. Bila orientasinya jauh berbeda (mis. struk tegak di kotak mendatar), foto
 * ditampilkan utuh di atas versi buram 95% dirinya sendiri supaya isi struk/nopol tidak terpotong.
 */
function letakkan(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const beda = img.naturalWidth / img.naturalHeight / (w / h)
  if (beda > 0.8 && beda < 1.25) return penuhi(ctx, img, x, y, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  latarBuram(ctx, img, x, y, w, h)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.fillRect(x, y, w, h)
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

function cap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baris: string[]) {
  const fs = Math.max(13, Math.min(24, Math.round(w * 0.03)))
  const pad = Math.round(fs * 0.55)
  const tb = Math.round(fs * 1.28)
  const tinggi = pad * 2 + tb * baris.length
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)'
  ctx.fillRect(x, y + h - tinggi, w, tinggi)
  ctx.textBaseline = 'top'
  baris.forEach((t, i) => {
    ctx.font = `${i === 0 ? '700' : '500'} ${i === 0 ? fs : Math.round(fs * 0.86)}px ${HURUF}`
    ctx.fillStyle = i === 0 ? '#ffd54f' : '#ffffff'
    // maxWidth: teks panjang dipadatkan, tidak terpotong.
    ctx.fillText(t, x + pad, y + h - tinggi + pad + i * tb, w - pad * 2)
  })
}

/** [kiri atas, kiri bawah, kanan] → JPEG kolase. */
export async function buatKolase([kiriAtas, kiriBawah, kanan]: [BagianKolase, BagianKolase, BagianKolase], quality = 0.85): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = LEBAR
  canvas.height = TINGGI
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Perangkat tidak dapat membuat kolase foto')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LEBAR, TINGGI)
    const kolom = (LEBAR - GARIS * 3) / 2
    const sel = (TINGGI - GARIS * 3) / 2
    const kotak: [BagianKolase, number, number, number, number][] = [
      [kiriAtas, GARIS, GARIS, kolom, sel],
      [kiriBawah, GARIS, GARIS * 2 + sel, kolom, sel],
      [kanan, GARIS * 2 + kolom, GARIS, kolom, TINGGI - GARIS * 2],
    ]
    for (const [b, x, y, w, h] of kotak) {
      const img = await muat(b.blob)
      letakkan(ctx, img, x, y, w, h)
      img.removeAttribute('src')
      cap(ctx, x, y, w, h, b.cap)
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Gagal membuat kolase foto')
    return blob
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Kolase N foto dalam grid (2 kolom untuk 2-4 foto, 3 kolom untuk lebih), garis putih tipis; baris
 * terakhir yang tidak penuh dilebarkan memenuhi lebar gambar. Tiga foto memakai tata letak Guard Tour.
 */
export async function buatKolaseGrid(bagian: BagianKolase[], quality = 0.85): Promise<Blob> {
  if (bagian.length === 3) return buatKolase(bagian as [BagianKolase, BagianKolase, BagianKolase], quality)
  const n = Math.max(1, bagian.length)
  const kol = n === 1 ? 1 : n <= 4 ? 2 : 3
  const baris = Math.ceil(n / kol)
  const lebarSel = (LEBAR - GARIS * (kol + 1)) / kol
  const tinggiSel = Math.round(lebarSel * (kol === 1 ? 0.75 : 0.8))
  const tinggi = Math.round(baris * tinggiSel + GARIS * (baris + 1))
  const canvas = document.createElement('canvas')
  canvas.width = LEBAR
  canvas.height = tinggi
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Perangkat tidak dapat membuat kolase foto')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LEBAR, tinggi)
    for (let r = 0; r < baris; r++) {
      const isi = bagian.slice(r * kol, (r + 1) * kol)
      const w = (LEBAR - GARIS * (isi.length + 1)) / isi.length
      const y = GARIS + r * (tinggiSel + GARIS)
      for (const [c, b] of isi.entries()) {
        const x = GARIS + c * (w + GARIS)
        const img = await muat(b.blob)
        letakkan(ctx, img, x, y, w, tinggiSel)
        img.removeAttribute('src')
        cap(ctx, x, y, w, tinggiSel, b.cap)
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Gagal membuat kolase foto')
    return blob
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
