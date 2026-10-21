/**
 * Absensi personil: Excel rekap bulanan (lembar Rekap per personil & Detail harian) dan poster QR absensi
 * (PDF A4) untuk ditempel di SPBU.
 */
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { jamDari, menitKerja, menitTerlambat, type AbsenRecord } from '@/lib/absen'
import { kodeInfo } from '@/lib/personil'
import { Lembar, tulisXlsx, type Gaya } from './xlsx-tulis'

const H: Gaya = { b: true, border: true, align: 'center', wrap: true, fill: true }
const T: Gaya = { border: true }
const TC: Gaya = { border: true, align: 'center' }
const N: Gaya = { border: true, fmt: 'int', align: 'center' }
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const jam = (m: number) => Math.round((m / 60) * 100) / 100

export interface AbsenExport {
  bulan: string
  label: string
  spbu: string
  rekap: { p: { id: string; nama: string; jabatan: string }; hadir: number; kerja: number; istirahat: number; terlambat: number; menitTelat: number; tanpaKeluar: number; terjadwal: number }[]
  detail: AbsenRecord[]
  roster?: Record<string, Record<string, string>>
}

export async function absenXlsx(x: AbsenExport): Promise<Blob> {
  const r = new Lembar('Rekap').kolom({ A: 2, B: 5, C: 26, D: 18, E: 11, F: 11, G: 12, H: 14, I: 12, J: 12, K: 12 })
  r.set('B2', `REKAP ABSENSI PERSONIL ${x.spbu.toUpperCase()}`, { b: true, sz: 12 }).set('B3', `Periode ${x.label}`)
  r.baris('B5', ['No', 'Nama', 'Jabatan', 'Jadwal (hari)', 'Hadir (hari)', 'Terlambat (kali)', 'Total terlambat (menit)', 'Jam kerja bersih', 'Istirahat (jam)', 'Tanpa absen keluar'], H)
  x.rekap.forEach((y, i) => {
    const b = 6 + i
    r.set(`B${b}`, i + 1, TC).set(`C${b}`, y.p.nama, T).set(`D${b}`, y.p.jabatan, T)
    r.set(`E${b}`, y.terjadwal, N).set(`F${b}`, y.hadir, N).set(`G${b}`, y.terlambat, N).set(`H${b}`, y.menitTelat, N)
    r.set(`I${b}`, jam(y.kerja), { ...T, fmt: 'dec2' }).set(`J${b}`, jam(y.istirahat), { ...T, fmt: 'dec2' }).set(`K${b}`, y.tanpaKeluar, N)
  })
  r.set(`B${7 + x.rekap.length}`, 'Jam kerja = masuk s.d. keluar dikurangi istirahat (jam desimal). Terlambat terhadap jam mulai shift jadwal: 06:00 / 14:00 / 22:00.', { italic: true })

  const d = new Lembar('Detail').kolom({ A: 2, B: 12, C: 24, D: 16, E: 12, F: 9, G: 10, H: 22, I: 9, J: 10, K: 10, L: 12, M: 18 })
  d.set('B2', `DETAIL ABSENSI ${x.spbu.toUpperCase()} · ${x.label}`, { b: true, sz: 12 })
  d.baris('B4', ['Tanggal', 'Nama', 'Jabatan', 'Jadwal', 'Masuk', 'Terlambat (mnt)', 'Istirahat', 'Keluar', 'Kerja (jam)', 'Jarak masuk (m)', 'Akurasi GPS (m)', 'Dicatat oleh'], H)
  x.detail.forEach((a, i) => {
    const b = 5 + i
    const kode = x.roster?.[a.data.personilId]?.[String(Number(a.tanggal.slice(8)))]
    const telat = menitTerlambat(a.data, kodeInfo(kode)?.kode, a.tanggal)
    d.baris(`B${b}`, [ddmmyyyy(a.tanggal), a.data.nama, a.data.jabatan, kodeInfo(kode)?.label ?? '-', jamDari(a.data.masuk.at)], T)
    d.set(`G${b}`, telat ?? null, N)
    d.set(`H${b}`, a.data.istirahat.map((s) => `${jamDari(s.mulai.at)}–${s.selesai ? jamDari(s.selesai.at) : '?'}`).join(', ') || '-', T)
    d.set(`I${b}`, jamDari(a.data.keluar?.at), TC)
    d.set(`J${b}`, a.data.keluar ? jam(menitKerja(a.data)) : null, { ...T, fmt: 'dec2' })
    d.set(`K${b}`, a.data.masuk.jarak, N).set(`L${b}`, a.data.masuk.akurasi, N).set(`M${b}`, a.data.masuk.olehNama || '-', T)
  })
  return tulisXlsx([r, d])
}

/** Poster A4 QR absensi untuk ditempel di SPBU. */
export async function posterAbsenPdf(teks: string, namaSpbu: string, kodeSpbu: string): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const qr = await QRCode.toDataURL(teks, { margin: 1, width: 1200, errorCorrectionLevel: 'M' })
  doc.setFillColor(0, 80, 203)
  doc.rect(0, 0, 210, 38, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.text('ABSENSI PERSONIL', 105, 20, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`${namaSpbu}${kodeSpbu ? ` · ${kodeSpbu}` : ''}`, 105, 30, { align: 'center' })
  doc.setTextColor(0)
  doc.addImage(qr, 'PNG', 40, 52, 130, 130)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Cara absen (masuk, istirahat, keluar):', 25, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  ;['1. Buka FLOQ > Operation > Absensi Personil.', '2. Pilih nama Anda, ketuk Absen masuk / Mulai istirahat / Selesai istirahat / Absen keluar.', '3. Izinkan lokasi (GPS) dan kamera, lalu pindai QR ini.', '4. Absen hanya diterima di area SPBU ini.'].forEach((t, i) =>
    doc.text(doc.splitTextToSize(t, 160), 25, 212 + i * 11),
  )
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text('Jangan difoto untuk dibawa pulang. QR dapat diganti pengawas kapan saja.', 105, 285, { align: 'center' })
  return doc.output('blob')
}
