/**
 * PDF label QR APAR/APAB di kertas A4: 2 kolom x 4 baris (8 label per lembar, 92 x 66 mm).
 * Dibuat langsung sebagai PDF agar ukurannya sama di semua HP/printer (cetak dari browser
 * di iPhone memakai skala sendiri sehingga label terpotong). Teks dikecilkan otomatis agar muat.
 */
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { aparUnitUrl, jenisLengkap, tipeLabel, warnaLabel, type AparTipe, type AparUnit } from '@/lib/apar'

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

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
const PT = 25.4 / 72

/** Ukuran huruf terbesar (pt) agar teks satu baris muat di lebar mm. */
function pasFont(doc: jsPDF, teks: string, lebar: number, maks: number, min: number) {
  for (let fs = maks; fs > min; fs -= 0.5) {
    doc.setFontSize(fs)
    if (doc.getTextWidth(teks) <= lebar) return fs
  }
  doc.setFontSize(min)
  return min
}

export async function exportLabelAparPdf(labels: { u: AparUnit; tipe: AparTipe }[], namaSpbu: string, filename: string) {
  const qr = await Promise.all(labels.map(({ u }) => QRCode.toDataURL(aparUnitUrl(u.id), { margin: 1, width: 600, errorCorrectionLevel: 'M' })))
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.setProperties({ title: 'Label QR APAR & APAB', creator: `FLOQ · ${namaSpbu}` })
  const nama = (namaSpbu || 'SPBU').toUpperCase()

  labels.forEach(({ u, tipe }, i) => {
    const n = i % (KOLOM * BARIS)
    if (i > 0 && n === 0) doc.addPage()
    const x = GX + (n % KOLOM) * (LW + GX)
    const y = GY + Math.floor(n / KOLOM) * (LH + GY)
    const warna = rgb(warnaLabel(tipe, u.cadangan))

    // Bingkai: kepala berwarna, badan putih, garis hitam.
    doc.setFillColor(...warna)
    doc.roundedRect(x, y, LW, LH, 3, 3, 'F')
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y + KEPALA, LW, LH - KEPALA, 3, 3, 'F')
    doc.rect(x, y + KEPALA, LW, 4, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, LW, LH, 3, 3, 'S')

    // Nama SPBU: satu baris, mengecil bila panjang; dua baris bila tetap tidak muat.
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    const lebarKepala = LW - 2 * PAD
    const fsKepala = pasFont(doc, nama, lebarKepala, 10, 7)
    const barisKepala = fsKepala > 7 ? [nama] : (doc.splitTextToSize(nama, lebarKepala) as string[]).slice(0, 2)
    if (barisKepala.length > 1) doc.setFontSize(6.5)
    const tinggiBaris = doc.getFontSize() * PT * 1.1
    const yKepala = y + KEPALA / 2 - ((barisKepala.length - 1) * tinggiBaris) / 2
    barisKepala.forEach((t, k) => doc.text(t, x + PAD, yKepala + k * tinggiBaris, { baseline: 'middle' }))

    // QR di kiri.
    const badanY = y + KEPALA
    const badanH = LH - KEPALA
    doc.addImage(qr[i], 'PNG', x + PAD, badanY + (badanH - QR) / 2, QR, QR)

    // Teks di kanan QR.
    const tx = x + PAD + QR + PAD
    const tw = x + LW - PAD - tx
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    const kode = u.kode || '-'
    const fsKode = pasFont(doc, kode, tw, 22, 11)
    const kodeBaris = (doc.splitTextToSize(kode, tw) as string[]).slice(0, 2)
    const hKode = kodeBaris.length * fsKode * PT * 1.05

    const badge = tipeLabel(tipe, u.cadangan).toUpperCase()
    doc.setFontSize(8)
    const fsBadge = pasFont(doc, badge, tw - 2, 8, 6)
    const hBadge = fsBadge * PT + 2

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const lh = 8.5 * PT * 1.2
    const detail = (doc.splitTextToSize(`${jenisLengkap(u)}, ${u.kapasitasKg || '-'}\u00a0kg`, tw) as string[]).slice(0, 3)
    const lokasi = (doc.splitTextToSize(u.lokasi || '-', tw) as string[]).slice(0, 2)
    const total = hKode + 2 + hBadge + 2 + detail.length * lh + 1.5 + lokasi.length * lh
    let ty = badanY + Math.max(2, (badanH - total) / 2)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fsKode)
    kodeBaris.forEach((t) => {
      doc.text(t, tx, ty, { baseline: 'top' })
      ty += fsKode * PT * 1.05
    })
    ty += 2

    doc.setFontSize(fsBadge)
    const bw = Math.min(tw, doc.getTextWidth(badge) + 2.4)
    doc.setDrawColor(...warna)
    doc.setLineWidth(0.4)
    doc.roundedRect(tx, ty, bw, hBadge, 0.8, 0.8, 'S')
    doc.setTextColor(...warna)
    doc.text(badge, tx + 1.2, ty + hBadge / 2, { baseline: 'middle' })
    ty += hBadge + 2

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    detail.forEach((t) => {
      doc.text(t, tx, ty, { baseline: 'top' })
      ty += lh
    })
    ty += 1.5
    doc.setFont('helvetica', 'normal')
    lokasi.forEach((t) => {
      doc.text(t, tx, ty, { baseline: 'top' })
      ty += lh
    })
  })

  doc.save(filename)
}
