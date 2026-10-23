/**
 * Cetak Voucher Petty Cash (PDF A4) untuk rentang tanggal pengajuan: halaman voucher (format SPBU: kepala SPBU
 * & nomor voucher, tabel No / Nama Account (COA) / Keterangan / Jumlah, Total, terbilang, tanda tangan BUH
 * SPBU, Admin, Kasir), lalu halaman lampiran berisi foto struk pembelian dan foto barang tiap pengajuan.
 */
import { jsPDF } from 'jspdf'
import type { BarisVoucherCetak } from '@/lib/petty'
import type { Settings } from '@/lib/sop'
import { terbilang } from '@/lib/so'

const KIRI = 40
const LEBAR = 515
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

export interface VoucherPdfInput {
  nomor: string
  /** Tanggal cetak voucher (YYYY-MM-DD). */
  tanggal: string
  dari: string
  sampai: string
  baris: BarisVoucherCetak[]
  settings: Pick<Settings, 'kodeSpbu' | 'namaSpbu'>
  ttd: { buh: string; admin: string; kasir: string }
  /** Data URL foto per id Photo. */
  fotoData: Record<string, string>
}

function sel(doc: jsPDF, x: number, y: number, w: number, h: number, t: string, o: { bold?: boolean; align?: 'left' | 'center' | 'right'; fill?: boolean } = {}) {
  if (o.fill) {
    doc.setFillColor(232, 238, 248)
    doc.rect(x, y, w, h, 'FD')
  } else doc.rect(x, y, w, h)
  doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
  const lines = doc.splitTextToSize(t, w - 8) as string[]
  const tx = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w - 4 : x + 4
  doc.text(lines, tx, y + 13, { align: o.align ?? 'left' })
}

export function voucherPdf(v: VoucherPdfInput): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const nama = (v.settings.namaSpbu || 'SPBU').replace(/^SPBU\s*(COCO\s*)?/i, '').trim()
  doc.setProperties({ title: `Voucher Petty Cash ${v.nomor}`, creator: `FLOQ · SPBU ${nama}` })
  doc.setLineWidth(0.6)

  // Kepala voucher
  let y = 50
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('VOUCHER PETTY CASH', KIRI + LEBAR / 2, y, { align: 'center' })
  y += 22
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`SPBU COCO : ${v.settings.kodeSpbu || ''}`, KIRI, y)
  doc.text(`No. Voucher : ${v.nomor}`, KIRI + LEBAR, y, { align: 'right' })
  y += 14
  doc.text(`SPBU ${nama}`.toUpperCase(), KIRI, y)
  doc.text(`Tanggal : ${ddmmyyyy(v.tanggal)}`, KIRI + LEBAR, y, { align: 'right' })
  y += 14
  doc.text(`Periode pengajuan : ${ddmmyyyy(v.dari)} s.d. ${ddmmyyyy(v.sampai)}`, KIRI, y)
  y += 12
  doc.line(KIRI, y, KIRI + LEBAR, y)
  y += 12

  // Tabel realisasi
  const w = [28, 130, 252, 105]
  const kepala = ['No.', 'Nama Account (COA)', 'Keterangan', 'Jumlah']
  doc.setFontSize(9)
  let x = KIRI
  kepala.forEach((k, i) => {
    sel(doc, x, y, w[i], 20, k, { bold: true, align: 'center', fill: true })
    x += w[i]
  })
  y += 20
  const n = Math.max(8, v.baris.length)
  for (let i = 0; i < n; i++) {
    const b = v.baris[i]
    const ket = b ? `${b.keterangan} (${b.no}, ${b.pengaju}, diajukan ${ddmmyyyy(b.tanggalPengajuan)})` : ''
    const h = Math.max(20, ((doc.splitTextToSize(ket, w[2] - 8) as string[]).length || 1) * 11 + 8, ((doc.splitTextToSize(b?.coa ?? '', w[1] - 8) as string[]).length || 1) * 11 + 8)
    if (y + h > 760) {
      doc.addPage()
      y = 50
    }
    x = KIRI
    ;[String(i + 1), b?.coa ?? '', ket, b ? rp(b.jumlah) : ''].forEach((t, j) => {
      sel(doc, x, y, w[j], h, t, { align: j === 0 ? 'center' : j === 3 ? 'right' : 'left' })
      x += w[j]
    })
    y += h
  }
  const total = v.baris.reduce((a, b) => a + b.jumlah, 0)
  sel(doc, KIRI, y, w[0] + w[1] + w[2], 20, 'Total', { bold: true, align: 'center' })
  sel(doc, KIRI + w[0] + w[1] + w[2], y, w[3], 20, rp(total), { bold: true, align: 'right' })
  y += 30
  doc.setFont('helvetica', 'italic')
  doc.text(doc.splitTextToSize(`Terbilang : ${terbilang(total)}.`, LEBAR) as string[], KIRI, y)
  y += 40
  if (y > 700) {
    doc.addPage()
    y = 60
  }

  // Tanda tangan
  doc.setFont('helvetica', 'bold')
  const kol = LEBAR / 3
  ;[
    ['BUH. SPBU', v.ttd.buh],
    ['ADMIN', v.ttd.admin],
    ['KASIR', v.ttd.kasir],
  ].forEach(([j, nm], i) => {
    const cx = KIRI + kol * i + kol / 2
    doc.setFont('helvetica', 'bold')
    doc.text(j, cx, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.text(nm.trim() || '(.................................)', cx, y + 60, { align: 'center' })
  })

  // Lampiran foto struk & barang per pengajuan
  const lampiran = v.baris.filter((b) => b.struk.length || b.barang.length)
  for (const [i, b] of lampiran.entries()) {
    doc.addPage()
    let ly = 50
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`LAMPIRAN ${i + 1} · ${b.no}`, KIRI, ly)
    ly += 16
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(`${b.uraian} · ${b.coa} · ${rp(b.jumlah)} · pengaju ${b.pengaju} · realisasi ${ddmmyyyy(b.tanggalRealisasi)}`, LEBAR) as string[], KIRI, ly)
    ly += 24
    const foto = [...b.struk.map((p) => ({ p, label: 'Struk / nota pembelian' })), ...b.barang.map((p) => ({ p, label: 'Barang yang dibeli' }))].filter((f) => v.fotoData[f.p.id] || f.p.dataUrl).slice(0, 6)
    const kw = (LEBAR - 12) / 2
    const kh = 220
    foto.forEach((f, k) => {
      const cx = KIRI + (k % 2) * (kw + 12)
      const cy = ly + Math.floor(k / 2) * (kh + 26)
      const src = v.fotoData[f.p.id] || f.p.dataUrl || ''
      try {
        const pr = doc.getImageProperties(src)
        const s = Math.min(kw / pr.width, kh / pr.height)
        const iw = pr.width * s
        const ih = pr.height * s
        doc.addImage(src, 'JPEG', cx + (kw - iw) / 2, cy + (kh - ih) / 2, iw, ih)
      } catch {
        doc.text('Foto tidak dapat dimuat', cx + kw / 2, cy + kh / 2, { align: 'center' })
      }
      doc.rect(cx, cy, kw, kh)
      doc.setFontSize(9)
      doc.text(f.label, cx + kw / 2, cy + kh + 12, { align: 'center' })
      doc.setFontSize(10)
    })
    if (!foto.length) doc.text('Tidak ada foto terlampir.', KIRI, ly + 10)
  }
  return doc.output('blob')
}
