/**
 * PDF dari lembar Excel (xlsx-tulis): setiap lembar digambar seperti tampilannya di Excel (lebar kolom,
 * sel gabungan, garis, latar kepala tabel, huruf tebal/miring, rata, format angka) lalu dikecilkan agar
 * muat lebar kertas A4 (tegak, atau mendatar untuk lembar lebar). Dipakai BA Laporan Bulanan (SO) supaya
 * PDF dan Excel bersusunan sama.
 */
import { jsPDF } from 'jspdf'
import type { Gaya, Lembar, Nilai } from './xlsx-tulis'

const A4: [number, number] = [595.28, 841.89]
const M = 28
const BARIS = 15
const LATAR: [number, number, number] = [221, 235, 247]

const posisi = (r: string) => {
  const m = r.match(/^([A-Z]+)(\d+)$/)!
  return {
    c: m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0),
    r: Number(m[2]),
  }
}
/** Lebar kolom Excel (karakter) → pt. */
const lebarPt = (w: number) => w * 5.25 + 3.75
const LEBAR_BAWAAN = 8.43

/** Huruf di luar WinAnsi (font bawaan PDF) diganti padanannya. */
const aman = (s: string) =>
  s
    .replace(/[−‒]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\t\n\r -~\u00a0-\u00ff–—•…€]/g, '')

const id = (v: number, d: number) =>
  v.toLocaleString('id-ID', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
function teks(v: Nilai, g?: Gaya): { s: string; angka: boolean } {
  const x = v !== null && typeof v === 'object' ? v.v : v
  if (x === null || x === undefined || x === '') return { s: '', angka: false }
  if (typeof x === 'string') return { s: x, angka: false }
  if (!Number.isFinite(x)) return { s: '', angka: true }
  switch (g?.fmt) {
    case 'int':
      return { s: id(x, 0), angka: true }
    case 'dec1':
      return { s: id(x, 1), angka: true }
    case 'dec2':
      return { s: id(x, 2), angka: true }
    case 'pct':
      return { s: `${id(x, 2)}%`, angka: true }
    case 'rp':
    case 'akun':
      return {
        s: `${x < 0 ? '-' : ''}Rp ${id(Math.abs(Math.round(x)), 0)}`,
        angka: true,
      }
    default:
      return {
        s: x.toLocaleString('id-ID', { maximumFractionDigits: 4 }),
        angka: true,
      }
  }
}

interface Kotak {
  r1: number
  c1: number
  r2: number
  c2: number
}

function gambarLembar(doc: jsPDF, l: Lembar, kaki: string, pertama: boolean) {
  const sel = [...l.sel.entries()].map(([k, x]) => ({ ...posisi(k), ...x }))
  const gabung: Kotak[] = l.gabung.map((m) => {
    const [a, b] = m.split(':').map(posisi)
    return { r1: a.r, c1: a.c, r2: b.r, c2: b.c }
  })
  const maxC = Math.max(1, ...sel.map((x) => x.c), ...gabung.map((g) => g.c2))
  const maxR = Math.max(1, ...sel.map((x) => x.r), ...gabung.map((g) => g.r2))
  const lebar = Array.from({ length: maxC + 1 }, (_, c) => (c === 0 ? 0 : lebarPt(l.lebar[c] ?? LEBAR_BAWAAN)))
  const total = lebar.reduce((a, b) => a + b, 0)
  let k = 1
  const lebarRentang = (c1: number, c2: number) => lebar.slice(c1, c2 + 1).reduce((a, b) => a + b, 0) * k

  const anchor = new Map(gabung.map((g) => [`${g.r1},${g.c1}`, g]))
  const tertutup = new Set<string>()
  for (const g of gabung) for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (r !== g.r1 || c !== g.c1) tertutup.add(`${r},${c}`)

  const ukuran = (g?: Gaya) => (g?.sz ?? 11) * k * 0.86
  const setFont = (g?: Gaya) => {
    doc.setFont('helvetica', g?.b && g?.italic ? 'bolditalic' : g?.b ? 'bold' : g?.italic ? 'italic' : 'normal')
    doc.setFontSize(ukuran(g))
  }
  const baris = (s: string, w: number, g?: Gaya) => {
    setFont(g)
    return g?.wrap ? (doc.splitTextToSize(aman(s), Math.max(4, w - 4)) as string[]) : aman(s).split('\n')
  }

  // Tinggi baris: 15 pt, ditambah bila teks berbaris banyak (sel biasa) atau sel gabungan butuh ruang lebih.
  const hitungTinggi = () => {
    const tinggi = Array.from({ length: maxR + 1 }, () => BARIS * k)
    for (const x of sel) {
      if (anchor.has(`${x.r},${x.c}`) || tertutup.has(`${x.r},${x.c}`)) continue
      const t = teks(x.v, x.g).s
      if (!t) continue
      const n = baris(t, lebarRentang(x.c, x.c), x.g).length
      tinggi[x.r] = Math.max(tinggi[x.r], n * ukuran(x.g) * 1.2 + 4 * k)
    }
    for (const g of gabung) {
      const c = sel.find((s) => s.r === g.r1 && s.c === g.c1)
      if (!c) continue
      const t = teks(c.v, c.g).s
      if (!t) continue
      const perlu = baris(t, lebarRentang(g.c1, g.c2), c.g).length * ukuran(c.g) * 1.2 + 4 * k
      const ada = tinggi.slice(g.r1, g.r2 + 1).reduce((a, b) => a + b, 0)
      if (perlu > ada) tinggi[g.r2] += perlu - ada
    }
    return tinggi
  }
  // Skala per orientasi: muat lebar kertas; satu BA satu halaman bila cukup dikecilkan sampai 60%,
  // selain itu dipotong ke halaman berikutnya. Dipilih orientasi dengan tulisan terbesar (tegak bila sama).
  const panjang1 = hitungTinggi().reduce((a, b) => a + b, 0)
  const skala = ([pw, ph]: [number, number]) => {
    const kW = Math.min(1, (pw - M * 2) / total)
    const kH = (ph - M * 2 - 10) / panjang1
    return kH >= kW ? kW : kH >= kW * 0.6 ? kH * 0.97 : kW
  }
  const kTegak = skala(A4)
  const kDatar = skala([A4[1], A4[0]])
  const mendatar = kDatar > kTegak * 1.02
  const PH = mendatar ? A4[0] : A4[1]
  k = mendatar ? kDatar : kTegak
  const tinggi = hitungTinggi()
  const x0: number[] = [M]
  for (let c = 1; c <= maxC; c++) x0[c] = (x0[c - 1] ?? M) + (c === 1 ? 0 : lebar[c - 1] * k)
  const xKiri = (c: number) => x0[c]

  // Kelompok baris yang tidak boleh terpotong halaman (disatukan sel gabungan vertikal).
  const ujung = Array.from({ length: maxR + 1 }, (_, r) => r)
  for (const g of gabung) for (let r = g.r1; r <= g.r2; r++) ujung[r] = Math.max(ujung[r], g.r2)

  const kaki_ = (hal: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(110)
    doc.text(aman(`${kaki} · ${l.nama} · hal. ${hal}`), M, PH - 14)
    doc.setTextColor(0)
  }

  let hal = 1
  if (!pertama) doc.addPage('a4', mendatar ? 'landscape' : 'portrait')
  else if (mendatar) {
    doc.deletePage(1)
    doc.addPage('a4', 'landscape')
  }
  kaki_(hal)
  const yBaris: number[] = []
  const halBaris: number[] = []
  let y = M
  for (let r = 1; r <= maxR; ) {
    let akhir = r
    while (akhir < maxR && ujung[akhir] > akhir) akhir = ujung[akhir]
    for (let i = r; i <= akhir; i++) akhir = Math.max(akhir, ujung[i])
    const h = tinggi.slice(r, akhir + 1).reduce((a, b) => a + b, 0)
    if (y + h > PH - M - 10 && y > M) {
      doc.addPage('a4', mendatar ? 'landscape' : 'portrait')
      hal++
      kaki_(hal)
      y = M
    }
    for (let i = r; i <= akhir; i++) {
      yBaris[i] = y
      halBaris[i] = hal
      y += tinggi[i]
    }
    r = akhir + 1
  }

  // Gambar per halaman sesuai urutan baris.
  const halAwal = doc.getNumberOfPages() - hal + 1
  const gambar = (r: number, v: Nilai, g: Gaya | undefined, kotak: Kotak) => {
    doc.setPage(halAwal + halBaris[r] - 1)
    const x = xKiri(kotak.c1)
    const w = lebarRentang(kotak.c1, kotak.c2)
    const y1 = yBaris[kotak.r1]
    const h = tinggi.slice(kotak.r1, kotak.r2 + 1).reduce((a, b) => a + b, 0)
    if (g?.fill) {
      doc.setFillColor(...LATAR)
      doc.rect(x, y1, w, h, 'F')
    }
    doc.setDrawColor(60)
    doc.setLineWidth(0.5)
    if (g?.border) doc.rect(x, y1, w, h, 'S')
    if (g?.garis === 'atas') doc.line(x, y1, x + w, y1)
    if (g?.garis === 'bawah') doc.line(x, y1 + h, x + w, y1 + h)
    const { s, angka } = teks(v, g)
    if (!s) return
    const ls = baris(s, w, g)
    const fs = ukuran(g)
    const tinggiTeks = ls.length * fs * 1.2
    const atas = g?.valign === 'top' ? y1 + 2 * k : y1 + (h - tinggiTeks) / 2
    const rata = g?.align ?? (angka ? 'right' : 'left')
    const tx = rata === 'center' ? x + w / 2 : rata === 'right' ? x + w - 2 * k : x + 2 * k
    ls.forEach((t, i) => doc.text(t, tx, atas + fs * (i + 0.95), { align: rata }))
  }
  for (const x of sel) {
    if (tertutup.has(`${x.r},${x.c}`)) continue
    const g = anchor.get(`${x.r},${x.c}`)
    gambar(x.r, x.v, x.g, g ?? { r1: x.r, c1: x.c, r2: x.r, c2: x.c })
  }
  doc.setPage(doc.getNumberOfPages())
}

/** PDF semua lembar, berurutan. `kaki` = teks kaki halaman (mis. nama SPBU & periode). */
export function lembarPdf(lembar: Lembar[], kaki: string): Blob {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  })
  lembar.forEach((l, i) => gambarLembar(doc, l, kaki, i === 0))
  return doc.output('blob')
}
