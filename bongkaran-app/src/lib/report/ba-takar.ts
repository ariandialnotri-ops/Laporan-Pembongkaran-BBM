/**
 * PDF Berita Acara Uji Takar (tera bejana ukur 20 L) untuk satu tanggal uji, mengikuti format
 * laporan uji takar SPBU: info SPBU, hasil per nozzle, ringkasan, tanda tangan.
 * Versi lengkap menambah lampiran foto (dudukan bejana & water pass, hasil pengukuran) per hasil.
 */
import { jsPDF } from 'jspdf'
import type { TakarRecord } from '@/lib/daily'
import { parseAngka } from '@/lib/format'
import type { Photo, Settings } from '@/lib/sop'
import { FOTO_TAKAR, opsiLabel, takarStatus, TOLERANSI_TAKAR_ML } from '@/lib/takar'

const NAVY: [number, number, number] = [31, 78, 121]
const GARIS: [number, number, number] = [200, 200, 200]
const HIJAU: [number, number, number] = [56, 118, 29]
const MERAH: [number, number, number] = [192, 0, 0]
const ABU: [number, number, number] = [110, 110, 110]

const PW = 595.28
const PH = 841.89
const M = 34
const LEBAR = PW - M * 2
const BAWAH = PH - 52

export interface BaTakarInput {
  tanggal: string
  records: TakarRecord[]
  settings: Settings
  /** Isi foto (dataURL) per id foto; wajib untuk versi dengan lampiran. */
  fotoData?: Record<string, string>
}

const ddmmyyyy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '-')

/** Hash pendek dan stabil dari isi laporan: nomor BA & kode verifikasi berubah bila data berubah. */
function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

/** Baris hasil, urut nomor nozzle lalu P sebelum M. */
export function barisTakar(records: TakarRecord[]) {
  return [...records].sort(
    (a, b) => a.data.nozzle.localeCompare(b.data.nozzle, 'id', { numeric: true }) || a.data.opsi.localeCompare(b.data.opsi) * -1 || a.createdAt - b.createdAt,
  )
}

export function nomorBaTakar(kode: string, tanggal: string, records: TakarRecord[]) {
  const isi = barisTakar(records).map((r) => `${r.id}:${r.data.hasilMl}`).join('|')
  return `UT/${kode || 'SPBU'}/${hash(`${tanggal}|${isi}`).slice(0, 4)}`
}

function kodeVerifikasi(tanggal: string, records: TakarRecord[]) {
  const isi = barisTakar(records)
    .map((r) => `${r.data.nozzle}|${r.data.produk}|${r.data.opsi}|${r.data.hasilMl}|${r.data.jam}|${r.data.petugas}`)
    .join(';')
  const h = hash(`${tanggal};${isi}`)
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`
}

const qtyVar = (hasilMl: string) => {
  const v = parseAngka(hasilMl)
  return v === null ? '-' : `${((v / 20000) * 100).toFixed(2)}%`
}

type Sel = { t: string; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'center' }

/** Satu baris tabel bergaris; tinggi mengikuti teks terpanjang. Mengembalikan y berikutnya. */
function baris(doc: jsPDF, y: number, lebar: number[], sel: Sel[], opt: { fill?: [number, number, number]; header?: boolean; fs?: number; minH?: number } = {}) {
  const fs = opt.fs ?? 9
  doc.setFontSize(fs)
  const pad = 5
  const teks = sel.map((s, i) => {
    doc.setFont('helvetica', s.bold || opt.header ? 'bold' : 'normal')
    return doc.splitTextToSize(s.t || '-', lebar[i] - pad * 2) as string[]
  })
  const h = Math.max(opt.minH ?? 19, ...teks.map((l) => l.length * fs * 1.15 + 8))
  let x = M
  sel.forEach((s, i) => {
    if (opt.fill) {
      doc.setFillColor(...opt.fill)
      doc.rect(x, y, lebar[i], h, 'F')
    }
    doc.setDrawColor(...(opt.header ? NAVY : GARIS))
    doc.setLineWidth(0.6)
    doc.rect(x, y, lebar[i], h, 'S')
    doc.setFont('helvetica', s.bold || opt.header ? 'bold' : 'normal')
    doc.setTextColor(...(opt.header ? ([255, 255, 255] as [number, number, number]) : (s.color ?? [0, 0, 0])))
    const tinggiTeks = teks[i].length * fs * 1.15
    const ty = y + (h - tinggiTeks) / 2 + fs * 0.85
    if (s.align === 'left') doc.text(teks[i], x + pad, ty)
    else doc.text(teks[i], x + lebar[i] / 2, ty, { align: 'center' })
    x += lebar[i]
  })
  doc.setTextColor(0, 0, 0)
  return y + h
}

/** Pita judul bagian (latar biru, teks putih). */
function pita(doc: jsPDF, y: number, judul: string) {
  doc.setFillColor(...NAVY)
  doc.rect(M, y, LEBAR, 21, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(judul, M + 8, y + 14.5)
  doc.setTextColor(0, 0, 0)
  return y + 21
}

function kepala(doc: jsPDF, judul: string, sub: string) {
  doc.setFillColor(...NAVY)
  doc.rect(M, 34, LEBAR, 29, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(255, 255, 255)
  doc.text(judul, PW / 2, 53, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9.5)
  doc.text(sub, PW / 2, 79, { align: 'center' })
  return 92
}

/** Tabel dengan kepala yang diulang bila pindah halaman. */
function tabel(doc: jsPDF, y: number, lebar: number[], kepalaSel: string[], isi: Sel[][], lanjut: () => number) {
  const tulisKepala = (yy: number) => baris(doc, yy, lebar, kepalaSel.map((t) => ({ t })), { fill: NAVY, header: true, fs: 8.5, minH: 28 })
  y = tulisKepala(y)
  for (const r of isi) {
    if (y + 22 > BAWAH) {
      doc.addPage()
      y = tulisKepala(lanjut())
    }
    y = baris(doc, y, lebar, r, { minH: 19.5 })
  }
  return y
}

async function ukuranGambar(src: string) {
  return new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 3, h: img.naturalHeight || 4 })
    img.onerror = () => resolve({ w: 3, h: 4 })
    img.src = src
  })
}

export async function exportBaTakarPdf({ tanggal, records, settings, fotoData }: BaTakarInput, lampiran: boolean, filename: string) {
  const rows = barisTakar(records)
  const kode = settings.kodeSpbu?.trim() || ''
  const nama = settings.namaSpbu?.trim() || 'SPBU'
  const noBa = nomorBaTakar(kode, tanggal, rows)
  const verif = kodeVerifikasi(tanggal, rows)
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  doc.setProperties({ title: `Berita Acara Uji Takar ${noBa}`, subject: 'Berita Acara Uji Takar SPBU', creator: `FLOQ · ${nama}` })
  const judul = 'BERITA ACARA UJI TAKAR - TERA BEJANA UKUR 20 L'
  const sub = nama.toUpperCase()
  const lanjut = () => kepala(doc, judul, sub)

  let y = kepala(doc, judul, sub)

  // Informasi SPBU & uji
  y = pita(doc, y, 'INFORMASI SPBU & UJI TAKAR')
  const petugas = [...new Set(rows.map((r) => r.data.petugas).filter(Boolean))].join(', ') || '-'
  const jam = rows.map((r) => r.data.jam).filter(Boolean).sort()
  const info: [string, string, string, string][] = [
    ['Nomor SPBU', kode || '-', 'Nama SPBU', nama],
    ['Alamat', settings.alamatSpbu?.trim() || '-', 'No. Berita Acara', noBa],
    ['Tanggal Uji', ddmmyyyy(tanggal), 'Tanggal Laporan', ddmmyyyy(new Date().toISOString().slice(0, 10))],
    ['Petugas Uji', petugas, 'Jam Uji', jam.length ? (jam[0] === jam[jam.length - 1] ? jam[0] : `${jam[0]} - ${jam[jam.length - 1]}`) : '-'],
  ]
  const li = [100, LEBAR / 2 - 100, 100, LEBAR / 2 - 100]
  for (const [a, b, c, d] of info) y = baris(doc, y, li, [{ t: a, bold: true, align: 'left' }, { t: b, align: 'left' }, { t: c, bold: true, align: 'left' }, { t: d, align: 'left' }], { minH: 21 })
  y += 12

  // Hasil per nozzle
  y = pita(doc, y, 'HASIL UJI TAKAR PER NOZZLE')
  const ln = [50, 86, 118, 40, 72, 70, LEBAR - 50 - 86 - 118 - 40 - 72 - 70]
  y = tabel(
    doc,
    y,
    ln,
    ['Nozzle Number', 'Tanggal & Jam', 'Product', 'Mode', 'Hasil Tera (ml)', 'Qty Var (%)', 'Keterangan'],
    rows.map((r) => {
      const lewat = takarStatus(r.data.hasilMl) === 'lewat'
      const v = parseAngka(r.data.hasilMl)
      return [
        { t: r.data.nozzle },
        { t: `${ddmmyyyy(r.tanggal)} ${r.data.jam || ''}`.trim() },
        { t: r.data.produk.toUpperCase() },
        { t: r.data.opsi },
        { t: v === null ? '-' : String(v) },
        { t: qtyVar(r.data.hasilMl) },
        { t: lewat ? 'Tidak Sesuai' : 'Sesuai', bold: true, color: lewat ? MERAH : HIJAU },
      ]
    }),
    lanjut,
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...ABU)
  doc.text(`Mode: P = Preset, M = Manual · Batas tera ${TOLERANSI_TAKAR_ML} ml/20 L · Qty Var = hasil tera / 20.000 ml`, M, y + 12)
  doc.setTextColor(0, 0, 0)
  y += 26

  // Ringkasan
  const nozzleSpbu = settings.nozzles ?? []
  const nozzleDiuji = new Set(rows.map((r) => r.data.nozzle.trim().toUpperCase())).size
  const totalNozzle = Math.max(nozzleSpbu.length, nozzleDiuji)
  const lewat = rows.filter((r) => takarStatus(r.data.hasilMl) === 'lewat').length
  if (y + 30 > BAWAH) {
    doc.addPage()
    y = lanjut()
  }
  let x = M
  const kotak = (w: number, t: string, warna?: [number, number, number]) => {
    doc.setDrawColor(...GARIS)
    doc.rect(x, y, w, 30, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...(warna ?? ([0, 0, 0] as [number, number, number])))
    doc.text(t, x + 8, y + 19)
    doc.setTextColor(0, 0, 0)
    x += w
  }
  kotak(LEBAR / 2, `Nozzle diperiksa: ${nozzleDiuji} dari ${totalNozzle}`)
  kotak(LEBAR / 2, `Di bawah toleransi: ${lewat}`, lewat ? MERAH : undefined)
  y += 30

  // Tanda tangan
  if (y + 100 > BAWAH) {
    doc.addPage()
    y = lanjut()
  }
  y += 32
  const kiri = M + LEBAR * 0.25
  const kanan = M + LEBAR * 0.72
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Petugas Uji,', kiri, y, { align: 'center' })
  doc.text('Manajer / Pengawas SPBU,', kanan, y, { align: 'center' })
  y += 62
  doc.setFont('helvetica', 'bold')
  doc.text(rows[0]?.data.petugas || '(..............................)', kiri, y, { align: 'center' })
  doc.text(settings.namaPengawasDefault?.trim() ? `( ${settings.namaPengawasDefault.trim()} )` : '(..............................)', kanan, y, { align: 'center' })

  // Lampiran foto
  if (lampiran) {
    const judulL = 'LAMPIRAN FOTO UJI TAKAR'
    const subL = `${nama.toUpperCase()} · No. BA ${noBa} · ${ddmmyyyy(tanggal)}`
    doc.addPage()
    y = kepala(doc, judulL, subL)
    const kol = (LEBAR - 10) / 2
    const tinggiFoto = 300
    for (const [i, r] of rows.entries()) {
      const fotos: { p: Photo; label: string }[] = FOTO_TAKAR.flatMap((f) => r.data.foto[f.key].map((p) => ({ p, label: f.label })))
      const barisFoto = Math.max(1, Math.ceil(fotos.length / 2))
      const blok = 24 + barisFoto * (tinggiFoto + 18) + 10
      if (y + Math.min(blok, 24 + tinggiFoto + 18) > BAWAH) {
        doc.addPage()
        y = kepala(doc, judulL, subL)
      }
      const lw = takarStatus(r.data.hasilMl) === 'lewat'
      const v = parseAngka(r.data.hasilMl)
      y = pita(doc, y, `${i + 1}. ${ddmmyyyy(r.tanggal)} ${r.data.jam} · Nozzle ${r.data.nozzle} · ${r.data.produk.toUpperCase()} · ${opsiLabel(r.data.opsi)} (${r.data.opsi}) · ${v === null ? '-' : v} ml · ${lw ? 'Tidak Sesuai' : 'Sesuai'}`)
      y += 4
      for (let j = 0; j < fotos.length; j += 2) {
        if (y + tinggiFoto + 18 > BAWAH) {
          doc.addPage()
          y = kepala(doc, judulL, subL)
        }
        for (let k = 0; k < 2 && j + k < fotos.length; k++) {
          const { p, label } = fotos[j + k]
          const fx = M + k * (kol + 10)
          const src = fotoData?.[p.id] || p.dataUrl || ''
          doc.setDrawColor(...GARIS)
          doc.rect(fx, y, kol, tinggiFoto, 'S')
          if (src) {
            try {
              const u = await ukuranGambar(src)
              const s = Math.min((kol - 6) / u.w, (tinggiFoto - 6) / u.h)
              const w = u.w * s
              const h = u.h * s
              doc.addImage(src, 'JPEG', fx + (kol - w) / 2, y + (tinggiFoto - h) / 2, w, h)
            } catch {
              doc.setFontSize(8.5)
              doc.text('(foto tidak dapat dimuat)', fx + kol / 2, y + tinggiFoto / 2, { align: 'center' })
            }
          } else {
            doc.setFontSize(8.5)
            doc.text('(foto tidak tersedia)', fx + kol / 2, y + tinggiFoto / 2, { align: 'center' })
          }
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(...ABU)
          doc.text(label, fx + kol / 2, y + tinggiFoto + 11, { align: 'center' })
          doc.setTextColor(0, 0, 0)
        }
        y += tinggiFoto + 18
      }
      y += 10
    }
  }

  // Kaki halaman di semua halaman
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GARIS)
    doc.setLineWidth(0.5)
    doc.line(M, PH - 36, PW - M, PH - 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...ABU)
    doc.text(`FLOQ · No. BA ${noBa}`, M, PH - 24)
    doc.text(`Kode verifikasi laporan: ${verif}`, PW / 2, PH - 24, { align: 'center' })
    doc.text(`Hal ${i} / ${n}`, PW - M, PH - 24, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
  doc.save(filename)
}
