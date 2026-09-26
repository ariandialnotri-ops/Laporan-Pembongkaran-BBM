import html2canvas from 'html2canvas'

/** Render satu node (layout Berita Acara) menjadi satu gambar JPG utuh. */
export async function nodeToJpeg(node: HTMLElement, { scale = 1.5, quality = 0.85 } = {}) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))))
  const canvas = await html2canvas(node, { scale, useCORS: true, backgroundColor: '#ffffff', windowWidth: node.scrollWidth })
  return canvas.toDataURL('image/jpeg', quality)
}
