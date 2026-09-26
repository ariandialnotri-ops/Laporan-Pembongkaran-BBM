import { jsPDF } from 'jspdf'
// Entri ESM; entri utama paket ini UMD dan default-nya tidak terbaca oleh bundler Vite.
import autoTable, { type CellHookData, type UserOptions } from 'jspdf-autotable/es'
import { normalizeDensity } from '@/lib/density'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatMaybe, formatSigned, parseAngka } from '@/lib/format'
import { STEPS, type Derived, type Report, type Rules, type Settings } from '@/lib/sop'

const PRIMARY: [number, number, number] = [0, 80, 203] // --primary AeroShift
const ERROR_BG: [number, number, number] = [255, 218, 214] // --error-container
const yn = (b: boolean) => (b ? 'Ya' : 'Tidak')

type Doc = jsPDF & { lastAutoTable: { finalY: number } }

/**
 * Berita Acara Pembongkaran BBM (Quality & Quantity) + lampiran foto.
 * `photoData`: dataURL per id foto (foto dari Supabase diunduh lebih dulu).
 */
export function generateBaPdf({
  report,
  derived: x,
  settings,
  rules,
  photoData,
}: {
  report: Report
  derived: Derived
  settings: Settings
  rules: Rules
  photoData: Record<string, string>
}) {
  const d = report.data
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as Doc
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = 44

  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, 'PNG', pageWidth - margin - 80, y - 20, 80, 36)
    } catch {
      // logo gagal dimuat, lanjutkan tanpa logo
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('BERITA ACARA PEMBONGKARAN BBM', pageWidth / 2, y, { align: 'center' })
  doc.setFontSize(10)
  doc.text('(QUALITY & QUANTITY)', pageWidth / 2, y + 14, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${settings.namaSpbu || 'SPBU'}${settings.kodeSpbu ? ` (${settings.kodeSpbu})` : ''}`, pageWidth / 2, y + 28, { align: 'center' })
  y += 42

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: [
      ['No. Berita Acara', d.noBA || '-', 'Produk', d.produk || '-'],
      ['Tanggal / Jam Datang', `${formatTanggalIso(d.tanggalDatang)} ${d.jamDatang}`, 'Tangki Pendam', x.tank ? x.tank.label.replace('–', '-') : '-'],
      ['Keluar Depot', `${formatTanggalIso(d.tanggalKeluar)} ${d.jamKeluar}`, 'Nomor SO', d.noSO || '-'],
      ['No. Polisi MT', d.nopol || '-', 'Nomor LO', d.noLOs.join(', ') || '-'],
      ['Nama Driver', d.namaDriver || '-', 'No. Sold To', d.soldTo || '-'],
      ['Jumlah DO', `${d.jumlahDO || 0} DO (${formatMaybe(x.volumeDO)} L)`, 'Selesai Bongkar', d.jamSelesaiBongkar || '-'],
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 95, textColor: 90 }, 1: { cellWidth: 190, fontStyle: 'bold' }, 2: { cellWidth: 80, textColor: 90 }, 3: { fontStyle: 'bold' } },
  })
  y = doc.lastAutoTable.finalY + 8

  const statusText =
    report.status === 'anomali'
      ? 'ANOMALI - pembongkaran dihentikan karena selisih density melebihi toleransi.'
      : 'Pembongkaran telah dilaksanakan sesuai prosedur dengan hasil sebagai berikut.'
  doc.setFontSize(8.5)
  const narrative = doc.splitTextToSize(
    `Pada tanggal ${formatTanggalIso(d.tanggalDatang)} telah dilaksanakan pemeriksaan dan pembongkaran BBM ${d.produk} dari mobil tangki ${d.nopol || '-'}. ${statusText}`,
    pageWidth - margin * 2,
  )
  doc.text(narrative, margin, y + 8)
  y += narrative.length * 10 + 16

  const section = (title: string) => {
    if (y > pageHeight - 120) {
      doc.addPage()
      y = 44
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(title, margin, y)
    doc.setFont('helvetica', 'normal')
    y += 5
  }
  const table = (opts: UserOptions) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.8, cellPadding: 3 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      theme: 'grid',
      ...opts,
    })
    y = doc.lastAutoTable.finalY + 14
  }

  section('A. QUALITY')
  table({
    head: [['Komp', 'Density Obs', 'Suhu (°C)', 'Density 15°C', 'D15 Depot', 'Selisih', 'Metode', 'Status']],
    body: x.densityResults.map((r) => [
      r.kompartemenNo,
      formatDensity(r.obs),
      formatMaybe(parseAngka(r.suhu), 1),
      r.d15 ? formatDensity(r.d15.value) : '-',
      formatDensity(x.d15Depot),
      formatDensitySigned(r.selisih),
      r.d15 ? (r.d15.method === 'table' ? 'Tabel ASTM 53' : 'Rumus ASTM 53B') : '-',
      r.ok === null ? '-' : r.ok ? 'Sesuai' : 'ANOMALI',
    ]),
    didParseCell: (c: CellHookData) => {
      if (c.section === 'body' && x.densityResults[c.row.index]?.ok === false) c.cell.styles.fillColor = ERROR_BG
    },
  })
  table({
    body: [
      ['Toleransi selisih density', `maks ${String(rules.densityTolerance).replace('.', ',')}`],
      ['Density & suhu OBS depot', `${formatDensity(normalizeDensity(d.densityObsDepot))} @ ${d.suhuObsDepot || '-'} °C`],
      ['Water content kompartemen', d.airNihil === true ? 'Nihil' : d.airNihil === false ? 'Terdapat air - sudah dilakukan draining' : '-'],
      ['Sampel atas & bawah sesuai', yn(d.sampelSesuai)],
    ],
    theme: 'plain',
    columnStyles: { 0: { cellWidth: 170, textColor: 90 } },
  })

  section('B. QUANTITY - MOBIL TANGKI (DEEPSTICK vs BUKU TERA)')
  table({
    head: [['Komp', 'Tinggi Tera (mm)', 'Dip Aktual (mm)', 'Selisih (mm)', 'Kepekaan (L/mm)', 'Est. Selisih (L)', 'Status']],
    body: x.compartments.map((c) => [
      c.no,
      formatMaybe(parseAngka(c.tinggiTera)),
      formatMaybe(parseAngka(c.dipAktual)),
      c.selisihMm === null ? '-' : formatSigned(c.selisihMm),
      formatMaybe(parseAngka(c.kepekaan), 2),
      c.estLiter === null ? '-' : formatSigned(c.estLiter, 1),
      c.selisihMm === null ? '-' : c.outOfLimit ? `Di luar batas ${rules.teraToleranceMm} mm` : 'Sesuai',
    ]),
    didParseCell: (c: CellHookData) => {
      if (c.section === 'body' && x.compartments[c.row.index]?.outOfLimit) c.cell.styles.fillColor = ERROR_BG
    },
  })
  if (d.teraApproval) {
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(
      `Dilanjutkan atas izin: ${d.teraApproval.nama} (${d.teraApproval.jabatan}), ${new Date(d.teraApproval.waktu).toLocaleString('id-ID')}. Alasan: ${d.teraApproval.alasan}`,
      pageWidth - margin * 2,
    )
    doc.text(lines, margin, y - 4)
    y += lines.length * 10 + 6
  }

  section('C. QUANTITY - TANGKI PENDAM')
  const vol = (v: number | null | undefined) => formatMaybe(v)
  table({
    head: [['Uraian', 'Ketinggian (mm)', 'Volume (L)', 'Suhu (°C)', 'Keterangan']],
    body: [
      ['Stok awal (ATG sebelum bongkar)', formatMaybe(parseAngka(d.atgBefore.tinggi)), vol(x.stokAwal), d.atgBefore.suhu || '-', `Tabel kalibrasi: ${vol(x.atgBeforeTable?.volume)} L`],
      ['Volume DO diterima', '', vol(x.volumeDO), '', `${d.jumlahDO || 0} DO x ${formatMaybe(rules.literPerDO)} L`],
      ['Penjualan selama bongkar', '', vol(x.penjualan), '', ''],
      ['Stok akhir teoritis', '', vol(x.stokTeoritis), '', 'Stok awal + DO - penjualan'],
      ['Real stok (ATG setelah pengisian)', formatMaybe(parseAngka(d.atgAfter.tinggi)), vol(x.realStok), d.atgAfter.suhu || '-', `Dibaca ${x.settleMinutes ?? '-'} menit setelah bongkar`],
      ['Discharge gain / loss (ATG)', '', x.gainLoss === null ? '-' : formatSigned(x.gainLoss), '', `${x.gainLossPct === null ? '-' : formatSigned(x.gainLossPct, 2)} % dari volume DO`],
      ['Deepstick manual sebelum bongkar', formatMaybe(parseAngka(d.dipBeforeMm)), vol(x.dipBefore?.volume), '', 'Volume dari tabel kalibrasi'],
      ['Deepstick manual sesudah bongkar', formatMaybe(parseAngka(d.dipAfterMm)), vol(x.dipAfter?.volume), '', 'Volume dari tabel kalibrasi'],
      ['Gain / loss (deepstick manual)', '', x.gainLossDip === null ? '-' : formatSigned(x.gainLossDip), '', 'Penerimaan deepstick - volume DO'],
    ],
    columnStyles: { 0: { cellWidth: 160 } },
  })

  section('D. SAFETY & KELENGKAPAN')
  table({
    body: [
      ['APAR DCP min. 9 kg tersedia', yn(d.safetyApar), 'Segel kompartemen sesuai DO/LO', yn(d.segelSesuai)],
      ['Kabel arde terpasang', yn(d.safetyArde), 'Fillport sesuai produk', yn(d.fillportSesuai)],
      ['Petugas memakai atribut safety', yn(d.safetyAtribut), 'Water content nihil', d.airNihil === null ? '-' : yn(d.airNihil)],
    ],
    columnStyles: { 0: { cellWidth: 150, textColor: 90 }, 1: { cellWidth: 70, fontStyle: 'bold' }, 2: { cellWidth: 150, textColor: 90 }, 3: { fontStyle: 'bold' } },
  })

  if (d.catatan) {
    section('CATATAN')
    doc.setFontSize(8.5)
    const lines = doc.splitTextToSize(d.catatan, pageWidth - margin * 2)
    doc.text(lines, margin, y + 6)
    y += lines.length * 10 + 16
  }

  if (y > pageHeight - 110) {
    doc.addPage()
    y = 60
  }
  y += 6
  const colW = (pageWidth - margin * 2) / 3
  doc.setFontSize(8.5)
  ;[
    ['Petugas Penerima SPBU', d.namaPetugas],
    ['Driver Mobil Tangki', d.namaDriver],
    ['Mengetahui, Pengawas SPBU', d.namaPengawas],
  ].forEach(([role, name], i) => {
    const cx = margin + colW * i + colW / 2
    doc.text(role, cx, y, { align: 'center' })
    doc.text('(______________________)', cx, y + 50, { align: 'center' })
    doc.text(name || '-', cx, y + 62, { align: 'center' })
  })

  const groups = STEPS.flatMap((step, si) =>
    step.photos
      .filter((p) => (report.photos[p.key] ?? []).length)
      .map((p) => ({ title: `Tahap ${si + 1} - ${step.title}: ${p.label}`, photos: report.photos[p.key] })),
  )
  if (groups.length) {
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('LAMPIRAN FOTO EVIDENCE', margin, 44)
    y = 64
    const imgW = 250
    const imgH = 170
    const gap = pageWidth - margin * 2 - imgW * 2
    for (const g of groups) {
      if (y + 16 + imgH > pageHeight - 36) {
        doc.addPage()
        y = 44
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(g.title, margin, y)
      y += 6
      let col = 0
      for (const p of g.photos) {
        if (col === 0 && y + imgH > pageHeight - 36) {
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

  return doc
}
