/**
 * PDF Laporan Operasional SPBU satu bulan (A4 mendatar): kartu perawatan & checklist housekeeping
 * (aktivitas × tanggal, form bulanan aktivitas × bulan), sumur pantau, oil catcher, daftar temuan
 * dengan foto, dan breakdown (laporan kerusakan). Isi sama dengan Excel format asli.
 */
import { jsPDF } from 'jspdf'
import type { InsidenRecord } from '@/lib/daily'
import { aktivitasRapi, FORM_OIL, FORM_SUMUR, formById, formDasar, judulForm, statusOps, type OpsRecord } from '@/lib/ops'
import type { CellValue } from './numfmt'
import { HALAMAN_SHEET, type LembarOps } from './ops'
import type { Layout } from './sheet-canvas'
import type { Photo, Settings } from '@/lib/sop'

type RGB = [number, number, number]
const NAVY: RGB = [31, 78, 121]
const GARIS: RGB = [190, 190, 190]
const HIJAU: RGB = [56, 118, 29]
const MERAH: RGB = [192, 0, 0]
const ABU: RGB = [110, 110, 110]

const PW = 841.89
const PH = 595.28
const M = 28
const LEBAR = PW - M * 2
const BAWAH = PH - 34

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export interface OpsPdfInput {
  tahun: number
  bulan: number
  /** Catatan sejak 1 Januari tahun itu (form bulanan memakai kolom per bulan). */
  recs: OpsRecord[]
  kerusakan: InsidenRecord[]
  settings: Settings
  /** Kelompok form yang dicetak (mengikuti fasilitas SPBU). */
  grup: { judul: string; forms: string[] }[]
  /** Isi foto temuan (dataURL) per id foto; foto tanpa isi dilewati. */
  fotoData?: Record<string, string>
  /** Hari ini (YYYY-MM-DD): kolom setelahnya dibiarkan kosong. */
  hariIni: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const ddmm = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '-')

class Pdf {
  doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true })
  y = M
  halaman = 0
  judulLaporan: string
  subLaporan: string
  constructor(judulLaporan: string, subLaporan: string) {
    this.judulLaporan = judulLaporan
    this.subLaporan = subLaporan
  }

  /** Halaman baru dengan kepala laporan; mengembalikan y awal isi. */
  baru() {
    if (this.halaman++) this.doc.addPage()
    const d = this.doc
    d.setFillColor(...NAVY)
    d.rect(M, M, LEBAR, 24, 'F')
    d.setFont('helvetica', 'bold')
    d.setFontSize(11.5)
    d.setTextColor(255, 255, 255)
    d.text(this.judulLaporan, M + 8, M + 16)
    d.setFont('helvetica', 'normal')
    d.setFontSize(9)
    d.text(this.subLaporan, PW - M - 8, M + 16, { align: 'right' })
    d.setTextColor(0, 0, 0)
    this.y = M + 34
    return this.y
  }

  /** Halaman berisi satu gambar kartu (sheet template), dimuat utuh di dalam margin. */
  gambarHalaman(canvas: HTMLCanvasElement) {
    if (this.halaman++) this.doc.addPage()
    const lebar = PW - M * 2
    const tinggi = PH - M * 2 - 14
    const s = Math.min(lebar / canvas.width, tinggi / canvas.height)
    const w = canvas.width * s
    const h = canvas.height * s
    this.doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M + (lebar - w) / 2, M, w, h, undefined, 'FAST')
    this.y = BAWAH
  }

  muat(h: number) {
    return this.y + h <= BAWAH
  }

  /** Judul bagian (form); pindah halaman bila sisa ruang tidak cukup untuk `minimal`. */
  judul(teks: string, sub: string, minimal = 80) {
    if (!this.muat(minimal)) this.baru()
    const d = this.doc
    d.setFont('helvetica', 'bold')
    d.setFontSize(10.5)
    d.setTextColor(...NAVY)
    d.text(teks, M, this.y + 10)
    if (sub) {
      d.setFont('helvetica', 'normal')
      d.setFontSize(8)
      d.setTextColor(...ABU)
      d.text(sub, PW - M, this.y + 10, { align: 'right' })
    }
    d.setTextColor(0, 0, 0)
    this.y += 16
  }

  kaki() {
    const d = this.doc
    const n = d.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      d.setPage(i)
      d.setFont('helvetica', 'normal')
      d.setFontSize(7.5)
      d.setTextColor(...ABU)
      d.text(`FLOQ · ${this.judulLaporan} · ${this.subLaporan}`, M, PH - 16)
      d.text(`Halaman ${i} dari ${n}`, PW - M, PH - 16, { align: 'right' })
    }
    d.setTextColor(0, 0, 0)
  }
}

type Sel = { t: string; bold?: boolean; color?: RGB; align?: 'left' | 'center'; fill?: RGB; centang?: boolean }

/** Satu baris tabel bergaris; tinggi mengikuti teks terpanjang. */
function baris(p: Pdf, lebar: number[], sel: Sel[], opt: { header?: boolean; fs?: number; minH?: number; fill?: RGB; atas?: boolean } = {}) {
  const d = p.doc
  const fs = opt.fs ?? 7
  const pad = 3
  d.setFontSize(fs)
  const teks = sel.map((s, i) => {
    d.setFont('helvetica', s.bold || opt.header ? 'bold' : 'normal')
    return s.centang ? [] : (d.splitTextToSize(s.t, Math.max(4, lebar[i] - pad * 2)) as string[])
  })
  const h = Math.max(opt.minH ?? 12, ...teks.map((l) => l.length * fs * 1.15 + 4))
  let x = M
  sel.forEach((s, i) => {
    const fill = s.fill ?? opt.fill ?? (opt.header ? NAVY : undefined)
    if (fill) {
      d.setFillColor(...fill)
      d.rect(x, p.y, lebar[i], h, 'F')
    }
    d.setDrawColor(...GARIS)
    d.setLineWidth(0.4)
    d.rect(x, p.y, lebar[i], h, 'S')
    if (s.centang) {
      // Tanda centang digambar (huruf √ tidak ada di font standar PDF).
      const cx = x + lebar[i] / 2
      const cy = p.y + h / 2
      d.setDrawColor(...HIJAU)
      d.setLineWidth(1.1)
      d.line(cx - 3.2, cy, cx - 1, cy + 2.6)
      d.line(cx - 1, cy + 2.6, cx + 3.4, cy - 3)
    } else {
      d.setFont('helvetica', s.bold || opt.header ? 'bold' : 'normal')
      d.setTextColor(...(opt.header ? ([255, 255, 255] as RGB) : (s.color ?? [0, 0, 0])))
      // atas = teks rata atas (ruang di bawahnya untuk foto).
      const ty = opt.atas ? p.y + 4 + fs * 0.85 : p.y + (h - teks[i].length * fs * 1.15) / 2 + fs * 0.85
      if (s.align === 'left') d.text(teks[i], x + pad, ty)
      else d.text(teks[i], x + lebar[i] / 2, ty, { align: 'center' })
    }
    x += lebar[i]
  })
  d.setTextColor(0, 0, 0)
  p.y += h
  return h
}

/** Tinggi baris tanpa menggambar (untuk cek pindah halaman). */
function tinggiBaris(p: Pdf, lebar: number[], sel: Sel[], fs = 7, minH = 12) {
  p.doc.setFontSize(fs)
  return Math.max(minH, ...sel.map((s, i) => (s.centang ? 0 : (p.doc.splitTextToSize(s.t, Math.max(4, lebar[i] - 6)) as string[]).length * fs * 1.15 + 4)))
}

/** Tabel dengan kepala yang diulang di halaman baru. */



/** Sheet template -> form pemilik (untuk menyaring kartu sesuai fasilitas SPBU). */
const FORM_SHEET: Record<string, string> = {
  'PERAWATAN POMPA': 'pompa-dorong',
  'PERAWATAN TANGKI': 'tangki-dorong',
  'KARTU PERAWATAN POMPA & TANGKI': 'pompa-tangki-rutin',
  'KARTU PERAWATAN OUTLET RITEL': 'outlet-ritel',
  'LISPLANG KANOPY RAMBU2 DLL': 'hk-kanopi-totem',
  'SUMUR PANTAU': FORM_SUMUR,
  'OIL CATCHER': FORM_OIL,
}

/**
 * PDF Laporan Operasional dalam format asli: setiap kartu digambar dari tata letak sheet template Excel
 * (lebar kolom, sel gabungan, garis, font) dengan isi sel yang sama persis dengan file Excel, satu kartu
 * per halaman A4 mendatar. Lampiran: daftar temuan beserta fotonya.
 */
export async function buatOpsPdf(input: OpsPdfInput & { lembar: LembarOps[] }) {
  const { tahun, bulan, recs, settings, grup, fotoData, lembar } = input
  const bulanIso = `${tahun}-${pad2(bulan)}`
  const spbu = [settings.namaSpbu, settings.kodeSpbu && `No. ${settings.kodeSpbu}`].filter(Boolean).join(' · ') || 'SPBU'
  const p = new Pdf('LAPORAN OPERASIONAL SPBU', `${spbu} · ${BULAN[bulan - 1]} ${tahun}`)
  const [{ default: layouts }, { drawLayout, potongLayout }] = await Promise.all([import('@/data/ops-layouts.json'), import('./sheet-canvas')])
  const tampil = new Set(grup.flatMap((g) => g.forms).map(formDasar))
  const ada = (form?: string) => !form || tampil.has(formDasar(form))

  for (const l of lembar) {
    const lay = (layouts as unknown as Record<string, Layout>)[l.dari]
    if (!lay || !ada(FORM_SHEET[l.dari])) continue
    const values: Record<string, CellValue> = {}
    const formats: Record<string, string> = {}
    for (const [ref, c] of Object.entries(l.cells)) {
      values[ref] = c.value
      if (c.fmt) formats[ref] = c.fmt
    }
    const halaman = HALAMAN_SHEET[l.dari]?.filter((h) => ada(h.form)) ?? [{ rows: [lay.area.r1, lay.area.r2] as [number, number] }]
    for (const h of halaman) {
      const canvas = await drawLayout(potongLayout(lay, h.rows[0], h.rows[1]), values, { scale: 2, formats })
      p.gambarHalaman(canvas)
    }
  }
  p.baru()

  // Temuan bulan ini (tanda X, sumur tidak nihil, oil catcher penuh) beserta foto.
  const temuan = recs
    .filter((r) => r.tanggal.startsWith(bulanIso))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .flatMap((r) => {
      const d = r.data
      if (d.jenis === 'checklist') {
        const f = formById(r.form)
        return Object.entries(d.hasil)
          .filter(([, v]) => v === 'X')
          .map(([i]) => ({ r, judul: aktivitasRapi(f?.aktivitas[Number(i)] ?? '').item, catatan: d.temuan[i]?.catatan ?? '', foto: d.temuan[i]?.foto ?? [] }))
      }
      if (statusOps(r.form, r) !== 'temuan') return []
      return [{ r, judul: d.jenis === 'sumur' ? d.sumur.map((s, i) => `Sumur ${['I', 'II', 'III', 'IV'][i]}: ${s}`).join(', ') : `Kondisi: ${d.kondisi}`, catatan: [d.hasil, d.keterangan].filter(Boolean).join(' · '), foto: d.foto }]
    })
  p.judul(`Temuan bulan ini (${temuan.length})`, 'Aktivitas bertanda X, sumur pantau tidak nihil, oil catcher penuh')
  if (!temuan.length) {
    p.doc.setFont('helvetica', 'italic')
    p.doc.setFontSize(8)
    p.doc.text('Tidak ada temuan.', M, p.y + 8)
    p.y += 22
  } else {
    const FT = 62
    const lebar = [22, 58, 150, 170, LEBAR - 22 - 58 - 150 - 170]
    baris(p, lebar, ['No', 'Tanggal', 'Form', 'Temuan', 'Catatan & foto'].map((t) => ({ t })), { header: true })
    temuan.forEach((x, i) => {
      const foto = x.foto.map((f: Photo) => fotoData?.[f.id] || f.dataUrl || '').filter(Boolean).slice(0, 4)
      const sel: Sel[] = [{ t: String(i + 1) }, { t: ddmm(x.r.tanggal) }, { t: judulForm(x.r.form), align: 'left' }, { t: x.judul, align: 'left', color: MERAH }, { t: x.catatan || '-', align: 'left' }]
      const hTeks = tinggiBaris(p, lebar, sel)
      const h = foto.length ? Math.max(hTeks + FT + 6, 20) : hTeks
      if (!p.muat(h)) {
        p.baru()
        p.judul('Temuan bulan ini (lanjutan)', '', 0)
        baris(p, lebar, ['No', 'Tanggal', 'Form', 'Temuan', 'Catatan & foto'].map((t) => ({ t })), { header: true })
      }
      const y0 = p.y
      baris(p, lebar, sel, { minH: h, atas: foto.length > 0 })
      foto.forEach((src, k) => {
        const x0 = M + lebar.slice(0, 4).reduce((a, b) => a + b, 0) + 4 + k * (FT + 4)
        try {
          // Foto dimuat utuh dalam kotak FT × FT tanpa mengubah perbandingan sisi.
          const { width, height } = p.doc.getImageProperties(src)
          const skala = Math.min(FT / width, FT / height)
          p.doc.addImage(src, 'JPEG', x0 + (FT - width * skala) / 2, y0 + hTeks + (FT - height * skala) / 2, width * skala, height * skala, undefined, 'FAST')
        } catch {
          // Foto rusak/tidak terbaca dilewati.
        }
      })
    })
    p.y += 14
  }

  p.kaki()
  return p.doc
}

export async function exportOpsPdf(input: OpsPdfInput & { lembar: LembarOps[] }, filename: string) {
  ;(await buatOpsPdf(input)).save(filename)
}
