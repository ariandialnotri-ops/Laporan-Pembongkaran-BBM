/** Rasio kotak tanda tangan (lebar : tinggi), mengikuti kolom tanda tangan di Berita Acara. */
export const TTD_RASIO = 5 / 2

/** Batas tinta (alpha > 16) pada canvas, atau null bila kosong. */
function inkBox(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx || !c.width || !c.height) return null
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 16) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/**
 * Potong canvas ke batas tinta (dengan sedikit ruang) lalu perkecil ke maks 600x240,
 * sehingga tanda tangan mengisi penuh kotaknya di Berita Acara.
 */
export function trimCanvas(c: HTMLCanvasElement): string | null {
  const b = inkBox(c)
  if (!b) return null
  const pad = Math.round(Math.max(b.w, b.h) * 0.04) + 2
  const sx = Math.max(0, b.x - pad)
  const sy = Math.max(0, b.y - pad)
  const sw = Math.min(c.width - sx, b.w + pad * 2)
  const sh = Math.min(c.height - sy, b.h + pad * 2)
  const scale = Math.min(1, 600 / sw, 240 / sh)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(sw * scale))
  out.height = Math.max(1, Math.round(sh * scale))
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

/** Potong tanda tangan tersimpan (termasuk data lama yang banyak ruang kosong). */
export function trimSignature(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(trimCanvas(c) ?? src)
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}
