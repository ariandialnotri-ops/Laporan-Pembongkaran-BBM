/**
 * Kompres foto sebelum disimpan/diunggah: foto kamera HP bisa beberapa MB,
 * sedangkan satu pembongkaran berisi belasan foto.
 *
 * Hemat memori untuk iPhone: file dibaca lewat object URL (bukan dataURL
 * base64 berukuran MB), dan memori canvas dilepas segera setelah dipakai.
 * Safari memuat ulang halaman bila memorinya menipis saat kamera dibuka.
 */
export async function compressImage(file: Blob, { maxSize = 1280, quality = 0.72, cap }: { maxSize?: number; quality?: number; cap?: string[] } = {}): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  const canvas = document.createElement('canvas')
  try {
    img.src = url
    await img.decode()
    const ratio = Math.min(1, maxSize / img.naturalWidth, maxSize / img.naturalHeight)
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Perangkat tidak dapat memproses foto')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (cap?.length) capFoto(ctx, canvas.width, canvas.height, cap)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Gagal mengompres foto')
    return blob
  } catch (e) {
    throw e instanceof Error && e.message.startsWith('Gagal') ? e : new Error('Gagal memuat gambar')
  } finally {
    canvas.width = 0
    canvas.height = 0
    img.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file'))
    reader.readAsDataURL(blob)
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Cap waktu pada foto evidence: pita gelap di bawah berisi tanggal & jam pengambilan
 * (baris pertama, tebal) dan keterangan (SPBU, nozzle, dll.). Tertulis di gambar sehingga
 * ikut tersimpan, tercetak, dan terkirim.
 */
function capFoto(ctx: CanvasRenderingContext2D, w: number, h: number, baris: string[]) {
  const fs = Math.max(14, Math.round(Math.min(w, h) * 0.034))
  const pad = Math.round(fs * 0.6)
  const tinggiBaris = Math.round(fs * 1.3)
  const tinggi = pad * 2 + tinggiBaris * baris.length
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, h - tinggi, w, tinggi)
  ctx.textBaseline = 'top'
  baris.forEach((t, i) => {
    ctx.font = `${i === 0 ? '700' : '500'} ${i === 0 ? fs : Math.round(fs * 0.85)}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
    ctx.fillStyle = i === 0 ? '#ffd54f' : '#ffffff'
    ctx.fillText(t, pad, h - tinggi + pad + i * tinggiBaris, w - pad * 2)
  })
}

/** "11/10/2026 14:05:09 WIB" dari jam perangkat. */
export function capWaktu(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  const zona = -d.getTimezoneOffset() / 60
  const nama = zona === 7 ? 'WIB' : zona === 8 ? 'WITA' : zona === 9 ? 'WIT' : `GMT${zona >= 0 ? '+' : ''}${zona}`
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${nama}`
}
