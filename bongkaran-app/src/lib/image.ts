/**
 * Kompres foto sebelum disimpan/diunggah: foto kamera HP bisa beberapa MB,
 * sedangkan satu pembongkaran berisi belasan foto.
 *
 * Hemat memori untuk iPhone: file dibaca lewat object URL (bukan dataURL
 * base64 berukuran MB), dan memori canvas dilepas segera setelah dipakai.
 * Safari memuat ulang halaman bila memorinya menipis saat kamera dibuka.
 */
export async function compressImage(file: Blob, { maxSize = 1280, quality = 0.72 } = {}): Promise<Blob> {
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
