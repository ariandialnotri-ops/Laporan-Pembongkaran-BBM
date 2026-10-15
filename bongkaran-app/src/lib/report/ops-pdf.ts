/**
 * PDF Laporan Operasional SPBU satu bulan (A4 mendatar): kartu perawatan & checklist housekeeping
 * (aktivitas × tanggal, form bulanan aktivitas × bulan), sumur pantau, oil catcher, daftar temuan
 * dengan foto, dan breakdown (laporan kerusakan). Isi sama dengan Excel format asli.
 */
import { jsPDF } from 'jspdf'
import type { InsidenRecord } from '@/lib/daily'
import { aktivitasRapi, FORM_OIL, FORM_SUMUR, formById, jadwal, judulForm, opsId, statusOps, STATUS_LABEL, type OpsRecord, type OpsStatus } from '@/lib/ops'
import type { Photo, Settings } from '@/lib/sop'

type RGB = [number, number, number]
const NAVY: RGB = [31, 78, 121]
const GARIS: RGB = [190, 190, 190]
const HIJAU: RGB = [56, 118, 29]
const MERAH: RGB = [192, 0, 0]
const ABU: RGB = [110, 110, 110]
const LATAR: RGB = [234, 241, 251]
const PEKAN: RGB = [246, 246, 246]

const PW = 841.89
const PH = 595.28
const M = 28
const LEBAR = PW - M * 2
const BAWAH = PH - 34

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

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
const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s[0]!.toUpperCase())
    .join('')

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
function tabel(p: Pdf, lebar: number[], kepala: Sel[], isi: { sel: Sel[]; fill?: RGB; bold?: boolean }[], judulLanjut: string) {
  baris(p, lebar, kepala, { header: true })
  for (const r of isi) {
    const h = tinggiBaris(p, lebar, r.sel)
    if (!p.muat(h)) {
      p.baru()
      p.judul(`${judulLanjut} (lanjutan)`, '', 0)
      baris(p, lebar, kepala, { header: true })
    }
    baris(p, lebar, r.bold ? r.sel.map((s) => ({ ...s, bold: true })) : r.sel, { fill: r.fill })
  }
}

const selTanda = (v: string | undefined, tanda: 'OK' | '√'): Sel => {
  if (v === 'OK') return tanda === '√' ? { t: '', centang: true } : { t: 'OK', color: HIJAU, bold: true }
  if (v === 'X') return { t: 'X', color: MERAH, bold: true }
  if (v === '-') return { t: '-', color: ABU }
  return { t: '' }
}

const ringkasStatus = (st: OpsStatus[]) => {
  const n = (s: OpsStatus) => st.filter((x) => x === s).length
  const isi = st.filter((x) => x !== 'kosong').length
  return `${isi}/${st.length} terisi${n('temuan') ? ` · ${n('temuan')} ada temuan` : ''}${n('paraf') ? ` · ${n('paraf')} diparaf` : ''}`
}

export function buatOpsPdf(input: OpsPdfInput) {
  const { tahun, bulan, recs, kerusakan, settings, grup, fotoData, hariIni } = input
  const bulanIso = `${tahun}-${pad2(bulan)}`
  const nHari = new Date(tahun, bulan, 0).getDate()
  const byId = new Map(recs.map((r) => [r.id, r]))
  const tanggal = Array.from({ length: nHari }, (_, i) => `${bulanIso}-${pad2(i + 1)}`)
  const minggu = (t: string) => new Date(`${t}T00:00:00`).getDay() === 0
  const spbu = [settings.namaSpbu, settings.kodeSpbu && `No. ${settings.kodeSpbu}`].filter(Boolean).join(' · ') || 'SPBU'
  const p = new Pdf('LAPORAN OPERASIONAL SPBU', `${spbu} · ${BULAN[bulan - 1]} ${tahun}`)
  p.baru()

  for (const g of grup) {
    for (const id of g.forms) {
      if (id === FORM_SUMUR || id === FORM_OIL) continue
      const f = formById(id)
      if (!f) continue
      const bulanan = f.periode === 'bulanan'
      // Form harian: kolom tanggal; form bulanan: kolom Januari–Desember.
      const kolom = bulanan ? BLN.map((b, i) => ({ label: b, id: opsId(id, `${tahun}-${pad2(i + 1)}-01`), lewat: `${tahun}-${pad2(i + 1)}` > hariIni.slice(0, 7), libur: false })) : tanggal.map((t) => ({ label: String(Number(t.slice(8))), id: opsId(id, t), lewat: t > hariIni, libur: minggu(t) }))
      const wNo = 16
      const wAkt = bulanan ? 250 : 190
      const wKol = (LEBAR - wNo - wAkt) / kolom.length
      const lebar = [wNo, wAkt, ...kolom.map(() => wKol)]
      const rec = kolom.map((k) => byId.get(k.id))
      const st = kolom.flatMap((k, i) => (k.lewat ? [] : [statusOps(id, rec[i])]))
      p.judul(`${judulForm(id)}${bulanan ? ' (bulanan)' : ''}`, `${g.judul} · ${ringkasStatus(st)}`)
      const kepala: Sel[] = [{ t: 'No' }, { t: 'Aktivitas', align: 'left' }, ...kolom.map((k) => ({ t: k.label }))]
      let bagian = ''
      const isi: { sel: Sel[]; fill?: RGB; bold?: boolean }[] = []
      f.aktivitas.forEach((a, i) => {
        const r = aktivitasRapi(a)
        if (r.bagian && r.bagian !== bagian) {
          bagian = r.bagian
          isi.push({ sel: [{ t: '' }, { t: r.bagian, align: 'left' }, ...kolom.map(() => ({ t: '' }))], fill: LATAR, bold: true })
        }
        const j = bulanan ? '' : jadwal(a)
        isi.push({
          sel: [
            { t: String(i + 1) },
            { t: j && j !== 'harian' ? `${r.item} (${j})` : r.item, align: 'left' },
            ...kolom.map((k, ki): Sel => {
              const d = rec[ki]?.data
              const s = selTanda(d?.jenis === 'checklist' ? d.hasil[i] : undefined, f.tanda)
              return k.libur && !s.t && !s.centang ? { ...s, fill: PEKAN } : s
            }),
          ],
        })
      })
      isi.push({ sel: [{ t: '' }, { t: 'Petugas', align: 'left', bold: true }, ...rec.map((r): Sel => ({ t: r?.data.petugas ? inisial(r.data.petugas) : '', color: ABU }))] })
      isi.push({ sel: [{ t: '' }, { t: 'Paraf pengawas', align: 'left', bold: true }, ...rec.map((r): Sel => ({ t: r?.data.paraf ? inisial(r.data.paraf.nama) : '', color: NAVY, bold: true }))] })
      tabel(p, lebar, kepala, isi, judulForm(id))
      p.y += 14
    }
  }

  // Sumur pantau & oil catcher: satu baris per tanggal yang terisi.
  const tampil = new Set(grup.flatMap((g) => g.forms))
  for (const id of [FORM_SUMUR, FORM_OIL]) {
    if (!tampil.has(id)) continue
    const isiHari = tanggal.map((t) => byId.get(opsId(id, t))).filter((r): r is OpsRecord => !!r)
    const st = tanggal.filter((t) => t <= hariIni).map((t) => statusOps(id, byId.get(opsId(id, t))))
    p.judul(judulForm(id), `Pantauan lingkungan · ${ringkasStatus(st)}`)
    if (!isiHari.length) {
      p.doc.setFont('helvetica', 'italic')
      p.doc.setFontSize(8)
      p.doc.text('Belum ada catatan bulan ini.', M, p.y + 8)
      p.y += 22
      continue
    }
    const sumur = id === FORM_SUMUR
    const lebar = sumur ? [58, 62, 62, 62, 62, 120, 165, 90, 40, 65] : [58, 120, 140, 210, 110, 40, 107.89]
    const kepala: Sel[] = sumur
      ? ['Tanggal', 'Sumur I', 'Sumur II', 'Sumur III', 'Sumur IV', 'Hasil', 'Keterangan', 'Petugas', 'Jam', 'Paraf'].map((t) => ({ t }))
      : ['Tanggal', 'Kondisi', 'Hasil', 'Keterangan', 'Petugas', 'Jam', 'Paraf'].map((t) => ({ t }))
    const isi = isiHari.map((r) => {
      const d = r.data
      const paraf: Sel = { t: d.paraf?.nama ?? '', color: NAVY }
      if (d.jenis === 'sumur')
        return { sel: [{ t: ddmm(r.tanggal) }, ...[0, 1, 2, 3].map((i): Sel => ({ t: d.sumur[i] ?? '-', color: d.sumur[i] && d.sumur[i] !== 'Nihil' ? MERAH : undefined })), { t: d.hasil, align: 'left' as const }, { t: d.keterangan, align: 'left' as const }, { t: d.petugas }, { t: d.jam }, paraf] }
      if (d.jenis === 'oil') return { sel: [{ t: ddmm(r.tanggal) }, { t: d.kondisi, color: d.kondisi === 'Penuh' ? MERAH : undefined }, { t: d.hasil, align: 'left' as const }, { t: d.keterangan, align: 'left' as const }, { t: d.petugas }, { t: d.jam }, paraf] }
      return { sel: [] as Sel[] }
    })
    tabel(p, lebar, kepala, isi, judulForm(id))
    p.y += 14
  }

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

  // Breakdown: laporan kerusakan bulan ini (modul Insiden).
  const bd = [...kerusakan].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  p.judul(`Breakdown peralatan (${bd.length})`, 'Dari laporan kerusakan modul Insiden')
  if (!bd.length) {
    p.doc.setFont('helvetica', 'italic')
    p.doc.setFontSize(8)
    p.doc.text('Tidak ada laporan kerusakan.', M, p.y + 8)
    p.y += 22
  } else {
    const lebar = [22, 110, 190, 190, 90, 58, 58, LEBAR - 22 - 110 - 190 - 190 - 90 - 58 - 58]
    const kepala = ['No', 'Peralatan', 'Kerusakan', 'Tindakan', 'PIC', 'Tgl rusak', 'Tgl selesai', 'Status'].map((t) => ({ t }))
    tabel(
      p,
      lebar,
      kepala,
      bd.map((x, i) => {
        const selesai = x.data.riwayat.find((l) => l.status === 'selesai')
        const tindakan = [x.data.tindakanSegera, ...x.data.riwayat.slice(1).map((l) => l.catatan)].filter(Boolean).join('; ')
        return {
          sel: [
            { t: String(i + 1) },
            { t: x.data.aset || x.data.kategori, align: 'left' as const },
            { t: x.data.uraian, align: 'left' as const },
            { t: tindakan || '-', align: 'left' as const },
            { t: x.data.pic || x.data.pelapor },
            { t: ddmm(x.tanggal) },
            { t: selesai ? ddmm(selesai.at.slice(0, 10)) : '-' },
            { t: x.data.status === 'selesai' ? 'Selesai' : 'Belum selesai', color: x.data.status === 'selesai' ? HIJAU : MERAH },
          ],
        }
      }),
      'Breakdown peralatan',
    )
  }

  // Keterangan tanda & pengesahan.
  if (!p.muat(70)) p.baru()
  p.y += 6
  const d = p.doc
  d.setFont('helvetica', 'normal')
  d.setFontSize(7.5)
  d.setTextColor(...ABU)
  d.text(`Keterangan: OK / centang = baik · X = ada temuan (catatan & foto) · - = tidak dilakukan · kolom abu-abu = hari Minggu · Status: ${Object.values(STATUS_LABEL).join(', ')}`, M, p.y)
  d.setTextColor(0, 0, 0)
  const pengawas = settings.namaPengawasDefault?.trim() || '....................'
  const kx = PW - M - 180
  d.setFontSize(9)
  d.text(`${BULAN[bulan - 1]} ${tahun}`, kx + 90, p.y + 14, { align: 'center' })
  d.text('Pengawas SPBU', kx + 90, p.y + 26, { align: 'center' })
  d.text(`( ${pengawas} )`, kx + 90, p.y + 64, { align: 'center' })

  p.kaki()
  return p.doc
}

export function exportOpsPdf(input: OpsPdfInput, filename: string) {
  buatOpsPdf(input).save(filename)
}
