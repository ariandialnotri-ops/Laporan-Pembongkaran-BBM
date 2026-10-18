/**
 * Modul Operasional SPBU: 14 format laporan operasional (kartu perawatan, housekeeping,
 * sumur pantau, oil catcher, breakdown). Satu catatan = satu form pada satu tanggal;
 * form bulanan disimpan pada tanggal 1. Disimpan di tabel bbm_ops.
 *
 * Katalog form (aktivitas & letak sel di template Excel asli) ada di ops-katalog.json,
 * dihasilkan dari file "Format laporan lengkap SPBU Operation".
 */
import katalog from '@/lib/ops-katalog.json'
import type { Role } from '@/lib/roles'
import type { Photo, Settings } from '@/lib/sop'
import { TANKS } from '@/lib/tank'

export type Tanda = 'OK' | 'X' | '-'

export interface OpsBlok {
  sheet: string
  /** Hari (form harian) atau bulan (form bulanan) -> kolom Excel (1-based). */
  kolom: Record<string, number>
  /** [baris Excel, indeks aktivitas]. */
  baris: [number, number][]
  /** Baris paraf pengawas; null bila format tidak punya baris paraf. */
  paraf: number | null
  /** Sel gabungan yang bukan sel utama: tidak diisi saat ekspor. */
  lewati: string[]
}

export interface OpsForm {
  id: string
  judul: string
  kategori: 'rawat' | 'hk'
  /** Fasilitas SPBU yang dibutuhkan; null = semua SPBU punya. */
  fasilitas: string | null
  periode: 'harian' | 'bulanan'
  /** Tanda "baik" di format asli. */
  tanda: 'OK' | '√'
  aktivitas: string[]
  blok: OpsBlok[]
}

const K = katalog as unknown as { forms: OpsForm[]; kepala: [string, string, string][] }
export const OPS_FORMS: OpsForm[] = K.forms
/** Sel judul template yang memuat kode SPBU / bulan / tahun: [sheet, sel, teks dengan {KODE} {KOTA} {BULAN} {TAHUN} {TAHUN#}]. */
export const OPS_KEPALA = K.kepala

export const FORM_SUMUR = 'sumur-pantau'
export const FORM_OIL = 'oil-catcher'

/** Fasilitas yang menentukan form mana yang tampil (Identitas SPBU). */
export const FASILITAS: { key: string; label: string }[] = [
  { key: 'pompaDorong', label: 'Pompa dorong (submersible) & tangkinya' },
  { key: 'genset', label: 'Genset' },
  { key: 'kantor', label: 'Kantor' },
  { key: 'toilet', label: 'Toilet' },
  { key: 'mushola', label: 'Mushola & tempat wudhu' },
  { key: 'enduro', label: 'Enduro Express' },
  { key: 'taman', label: 'Taman' },
  { key: 'gudang', label: 'Gudang & peralatan' },
  { key: 'ruangBuh', label: 'Ruang BUH' },
  { key: 'ruangIstirahat', label: 'Ruang istirahat' },
  { key: 'sumurPantau', label: 'Sumur pantau' },
  { key: 'oilCatcher', label: 'Oil catcher' },
]

/** undefined = belum diatur: semua fasilitas dianggap ada. */
export const punyaFasilitas = (s: Pick<Settings, 'fasilitas'>, key: string | null) => !key || !s.fasilitas || s.fasilitas.includes(key)

export interface OpsTemuan {
  catatan: string
  foto: Photo[]
}

export interface OpsParaf {
  nama: string
  at: string
}

export interface OpsChecklist {
  jenis: 'checklist'
  /** Indeks aktivitas -> tanda. */
  hasil: Record<string, Tanda>
  /** Wajib untuk setiap aktivitas bertanda X: catatan + foto. */
  temuan: Record<string, OpsTemuan>
  petugas: string
  jam: string
  paraf?: OpsParaf
}

export interface OpsSumur {
  jenis: 'sumur'
  /** Sumur I-IV. */
  sumur: string[]
  hasil: string
  keterangan: string
  /** Wajib bila ada sumur yang tidak nihil. */
  foto: Photo[]
  petugas: string
  jam: string
  paraf?: OpsParaf
}

export interface OpsOil {
  jenis: 'oil'
  kondisi: string
  hasil: string
  keterangan: string
  foto: Photo[]
  petugas: string
  jam: string
  paraf?: OpsParaf
}

export type OpsData = OpsChecklist | OpsSumur | OpsOil

export interface OpsRecord {
  id: string
  form: string
  tanggal: string
  data: OpsData
  updatedAt: number
  updatedBy: string | null
}

export const SUMUR_OPSI = ['Nihil', 'Ada lapisan BBM', 'Bau BBM']
export const OIL_OPSI = ['Bersih', 'Ada lapisan minyak', 'Penuh']

/** Catatan form pada tanggal itu: id tetap supaya simpan ulang menimpa catatan yang sama. */
export const opsId = (form: string, tanggal: string) => `${form}_${tanggal}`
/** Tanggal simpan: form bulanan memakai tanggal 1. */
export const tanggalSimpan = (f: Pick<OpsForm, 'periode'>, tanggal: string) => (f.periode === 'bulanan' ? `${tanggal.slice(0, 8)}01` : tanggal)

/**
 * Kartu yang dibuat satu per tangki pendam: di format asli kepala kartunya memuat No tangki, Produk, dan
 * Kapasitas. Kunci form = `<form>--<kode tangki>`; kode = hash pendek id tangki (kolom form di database
 * hanya menerima huruf kecil, angka, dan "-", maks. 40 karakter).
 */
export const PER_TANGKI = ['pompa-dorong', 'tangki-dorong', 'pompa-tangki-rutin']
export function kodeTangki(tankId: string) {
  let h = 0x811c9dc5
  for (const c of tankId) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0
  return h.toString(36).padStart(7, '0').slice(-7)
}
export const formTangki = (form: string, tankId: string) => `${form}--${kodeTangki(tankId)}`
/** Form katalog dari kunci (kunci per tangki -> form dasarnya). */
export const formDasar = (key: string) => key.split('--')[0]
export const kodeDariKunci = (key: string) => (key.includes('--') ? key.slice(key.indexOf('--') + 2) : null)

export interface TangkiOps {
  id: string
  tankNo: string
  produk: string
  /** Kapasitas (liter) dari tabel kalibrasi. */
  kapasitas: number
}
/** Tangki pendam SPBU aktif (database tangki, urut seperti di Pengaturan). */
// Urut nomor tangki (1, 2, 3 … lalu nama lain) agar kartu & sheet Excel berurutan.
export const tangkiOps = (): TangkiOps[] =>
  TANKS.map((t) => ({ id: t.id, tankNo: t.tankNo, produk: t.produk, kapasitas: t.capacity })).sort((a, b) => a.tankNo.trim().localeCompare(b.tankNo.trim(), 'id', { numeric: true }))
export const tangkiDariKunci = (key: string) => {
  const kode = kodeDariKunci(key)
  return kode ? (tangkiOps().find((t) => kodeTangki(t.id) === kode) ?? null) : null
}
export const labelTangki = (t: Pick<TangkiOps, 'tankNo' | 'produk'>) => `${/^\d+$/.test(t.tankNo.trim()) ? `Tangki ${t.tankNo.trim()}` : t.tankNo.trim()} · ${t.produk}`

export const formById = (id: string) => OPS_FORMS.find((f) => f.id === formDasar(id))

/** Kelompok tampilan di menu Operasional. */
export const OPS_GRUP: { judul: string; forms: string[] }[] = [
  { judul: 'Pompa & tangki', forms: ['pompa-dorong', 'tangki-dorong', 'pompa-tangki-rutin'] },
  { judul: 'Peralatan', forms: ['apar-harian', 'panel-listrik', 'genset'] },
  { judul: 'Kanopi, totem & outlet', forms: ['totem', 'kanopi-pompa', 'outlet-ritel'] },
  { judul: 'Housekeeping', forms: OPS_FORMS.filter((f) => f.kategori === 'hk').map((f) => f.id) },
  { judul: 'Pantauan lingkungan', forms: [FORM_SUMUR, FORM_OIL] },
]

export function judulForm(id: string) {
  if (id === FORM_SUMUR) return 'Sumur Pantau'
  if (id === FORM_OIL) return 'Oil Catcher'
  const dasar = formById(id)?.judul ?? id
  if (!kodeDariKunci(id)) return dasar
  const t = tangkiDariKunci(id)
  return `${dasar} · ${t ? labelTangki(t) : 'tangki'}`
}
const fasilitasForm = (id: string) => (id === FORM_SUMUR ? 'sumurPantau' : id === FORM_OIL ? 'oilCatcher' : (formById(id)?.fasilitas ?? null))

/** Siapa mengisi form apa (sama dengan aturan bbm_ops di database). Housekeeping hanya Cleaning Service. */
export function bolehIsi(role: Role, form: string) {
  if (form.startsWith('hk-')) return role === 'cs'
  if (role === 'abh' || role === 'pengawas') return true
  if (form === FORM_SUMUR || form === FORM_OIL) return role === 'kashift' || role === 'security'
  return role === 'kashift'
}
export const bolehParaf = (role: Role) => role === 'abh' || role === 'pengawas'
/** Boleh membuka form: pengisi, atau pengawas/ABH (melihat & memaraf). */
export const bolehLihat = (role: Role, form: string) => bolehIsi(role, form) || bolehParaf(role)

/**
 * Form yang tampil untuk peran ini di SPBU ini, per kelompok. Kartu pompa dorong, tangki pompa dorong, dan
 * rutin pompa & tangki dibuat satu per tangki pendam (database tangki); tanpa database tangki satu kartu umum.
 */
export function formTampil(role: Role, s: Pick<Settings, 'fasilitas'>, tanks: Pick<TangkiOps, 'id'>[] = tangkiOps()) {
  const perluas = (id: string) => (PER_TANGKI.includes(id) && tanks.length ? tanks.map((t) => formTangki(id, t.id)) : [id])
  return OPS_GRUP.map((g) => ({ ...g, forms: g.forms.flatMap(perluas).filter((id) => bolehLihat(role, id) && punyaFasilitas(s, fasilitasForm(id))) })).filter((g) => g.forms.length)
}

/** Nama aktivitas tanpa nomor catatan kaki; "Bagian · aktivitas" dipisah. */
export function aktivitasRapi(nama: string) {
  const bersih = nama.replace(/\s*\d\)\s*$/, '').trim()
  const [bagian, item] = bersih.includes(' · ') ? bersih.split(' · ') : ['', bersih]
  // Format asli sebagian berhuruf kapital semua: dijadikan huruf kalimat, singkatan dipertahankan.
  const kalimat = item === item.toUpperCase() ? item.toLowerCase().replace(/\b(apar|apab|bbm|bbk|ac|atg|buh)\b/g, (m) => m.toUpperCase()) : item
  return { bagian, item: kalimat.charAt(0).toUpperCase() + kalimat.slice(1) }
}

/** Jadwal aktivitas (dari catatan kaki & kolom jadwal format asli). Form bulanan: bawaan "bulanan". */
export function jadwal(nama: string, periode: OpsForm['periode'] = 'harian') {
  const t = nama.toLowerCase()
  if (t.includes('cuci tangki')) return '5 tahun sekali'
  if (t.includes('ganti oli')) return 'tiap 100 jam / bulanan'
  if (t.includes('cuci sajadah')) return 'sebulan sekali'
  if (t.includes('panaskan mesin')) return '3 hari sekali'
  if (t.includes('flow rate') || t.includes('pemeriksaan fungsi')) return 'sebulan sekali'
  if (['filter', 'bersihkan totem', 'bersihkan kanopi', 'cuci driveway', 'cuci kanopi', 'kuras', 'keset', 'penambahan gemuk', 'mencuci'].some((k) => t.includes(k))) return 'seminggu sekali'
  if (periode === 'bulanan') return /ganti (belt|swivel)/.test(t) ? 'bila diperlukan' : 'bulanan'
  return 'harian'
}

/** Selang hari tiap jadwal; null = tidak terjadwal (bila diperlukan). */
export const SELANG_HARI: Record<string, number | null> = {
  harian: 1,
  '3 hari sekali': 3,
  'seminggu sekali': 7,
  'sebulan sekali': 30,
  'tiap 100 jam / bulanan': 30,
  bulanan: 30,
  '5 tahun sekali': 1825,
  'bila diperlukan': null,
}

/** Ketentuan cara pengisian (dari kolom "Cara penggunaan" format asli). */
export const KETENTUAN_OPS = [
  'Beri tanda baik bila hasil pemeriksaan/pembersihan baik, X bila ada kerusakan (wajib catatan & foto), – bila tidak dikerjakan.',
  'Kerusakan yang ditemukan segera diperbaiki; hubungi vendor bila tidak dapat diperbaiki sendiri.',
  'Kerusakan dicatat sebagai laporan kerusakan (Breakdown) di menu Lapor.',
  'Aktivitas berjadwal (mis. seminggu sekali) wajib dikerjakan paling lambat pada tanggal jatuh temponya.',
]

export interface StatusJadwal {
  jadwal: string
  selang: number | null
  /** Tanggal terakhir dikerjakan (tanda baik/X) sebelum tanggal form. */
  terakhir: string | null
  /** Tanggal jatuh tempo berikutnya. */
  berikut: string | null
  /** Harus dikerjakan pada tanggal form (belum pernah / sudah lewat selangnya). */
  jatuhTempo: boolean
}

const tambahHari = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Jadwal aktivitas ke-i form `form` pada `tanggal`, dihitung dari catatan sebelumnya (`riwayat`). */
export function statusJadwal(form: string, i: number, tanggal: string, riwayat: OpsRecord[]): StatusJadwal {
  const f = formById(form)
  const j = f ? jadwal(f.aktivitas[i] ?? '', f.periode) : 'harian'
  const selang = SELANG_HARI[j] ?? null
  let terakhir: string | null = null
  for (const r of riwayat) {
    if (r.form !== form || r.tanggal >= tanggal || r.data.jenis !== 'checklist') continue
    const v = r.data.hasil[i]
    if ((v === 'OK' || v === 'X') && (!terakhir || r.tanggal > terakhir)) terakhir = r.tanggal
  }
  const berikut = selang && terakhir ? tambahHari(terakhir, selang) : null
  return { jadwal: j, selang, terakhir, berikut, jatuhTempo: !!selang && (!berikut || berikut <= tanggal) }
}

export type OpsStatus = 'kosong' | 'sebagian' | 'lengkap' | 'temuan' | 'paraf'
export const STATUS_LABEL: Record<OpsStatus, string> = { kosong: 'Belum diisi', sebagian: 'Sebagian', lengkap: 'Lengkap', temuan: 'Ada temuan', paraf: 'Diparaf' }

/** Aktivitas wajib: form harian hanya aktivitas harian; form bulanan semua aktivitas. */
export const aktivitasWajib = (f: OpsForm) => f.aktivitas.map((a, i) => [a, i] as const).filter(([a]) => f.periode === 'bulanan' || jadwal(a) === 'harian').map(([, i]) => i)

export function statusOps(form: string, rec: OpsRecord | undefined): OpsStatus {
  if (!rec) return 'kosong'
  const d = rec.data
  if (d.jenis === 'sumur') return d.sumur.some((x) => x !== 'Nihil') ? 'temuan' : d.paraf ? 'paraf' : 'lengkap'
  if (d.jenis === 'oil') return d.kondisi === 'Penuh' ? 'temuan' : d.paraf ? 'paraf' : 'lengkap'
  const f = formById(form)
  const vals = Object.values(d.hasil)
  if (vals.includes('X')) return 'temuan'
  const lengkap = !!f && aktivitasWajib(f).every((i) => d.hasil[i])
  if (lengkap && d.paraf) return 'paraf'
  return lengkap ? 'lengkap' : vals.length ? 'sebagian' : 'kosong'
}

/** Semua foto dalam catatan (untuk hapus & arsip). */
export function fotoOps(d: OpsData): Photo[] {
  if (d.jenis === 'checklist') return Object.values(d.temuan).flatMap((t) => t.foto)
  return d.foto
}

/** Validasi sebelum simpan: X wajib catatan + foto. Mengembalikan pesan galat atau null. */
export function cekOps(form: string, d: OpsData): string | null {
  if (!d.petugas.trim()) return 'Isi nama petugas.'
  if (d.jenis === 'checklist') {
    const f = formById(form)
    for (const [i, v] of Object.entries(d.hasil)) {
      if (v !== 'X') continue
      const t = d.temuan[i]
      const nama = f ? aktivitasRapi(f.aktivitas[Number(i)] ?? '').item : `aktivitas ${Number(i) + 1}`
      if (!t?.catatan.trim()) return `Tulis catatan temuan untuk "${nama}".`
      if (!t.foto.length) return `Foto temuan wajib untuk "${nama}".`
    }
    if (!Object.keys(d.hasil).length) return 'Tandai minimal satu aktivitas.'
    return null
  }
  if (d.jenis === 'sumur' && d.sumur.some((x) => x !== 'Nihil') && !d.foto.length) return 'Ada temuan di sumur pantau: foto wajib.'
  if (d.jenis === 'oil' && d.kondisi !== 'Bersih' && !d.foto.length) return 'Oil catcher tidak bersih: foto wajib.'
  if (!d.hasil.trim()) return 'Isi hasil pantauan.'
  return null
}

export function dataKosong(form: string, petugas: string, jam: string): OpsData {
  if (form === FORM_SUMUR) return { jenis: 'sumur', sumur: ['Nihil', 'Nihil', 'Nihil', 'Nihil'], hasil: 'Tidak ada BBM', keterangan: '', foto: [], petugas, jam }
  if (form === FORM_OIL) return { jenis: 'oil', kondisi: 'Bersih', hasil: 'Normal', keterangan: '', foto: [], petugas, jam }
  return { jenis: 'checklist', hasil: {}, temuan: {}, petugas, jam }
}

/** Jumlah bulan foto disimpan sebelum cut-off tanggal 5 (bawaan 3). */
export const fotoSimpanBulan = (s: Pick<Settings, 'fotoSimpanBulan'>) => Math.min(24, Math.max(1, Math.round(s.fotoSimpanBulan ?? 3)))

export interface KepatuhanHari {
  tanggal: string
  /** Form harian yang wajib diisi hari itu. */
  total: number
  /** Lengkap (termasuk diparaf / ada temuan). */
  lengkap: number
  sebagian: number
  temuan: number
  /** Tanggal setelah hari ini: belum dinilai. */
  nanti: boolean
}

/** Kepatuhan pengisian form harian (`forms`) per tanggal dalam satu bulan. */
export function kepatuhanBulan(forms: string[], recs: OpsRecord[], bulan: string, hariIni: string) {
  const harian = forms.filter((id) => formById(id)?.periode !== 'bulanan')
  const byId = new Map(recs.map((r) => [r.id, r]))
  const n = new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0).getDate()
  const hari: KepatuhanHari[] = Array.from({ length: n }, (_, i) => {
    const tanggal = `${bulan}-${String(i + 1).padStart(2, '0')}`
    const st = harian.map((id) => statusOps(id, byId.get(opsId(id, tanggal))))
    return {
      tanggal,
      total: harian.length,
      lengkap: st.filter((x) => x === 'lengkap' || x === 'paraf' || x === 'temuan').length,
      sebagian: st.filter((x) => x === 'sebagian').length,
      temuan: st.filter((x) => x === 'temuan').length,
      nanti: tanggal > hariIni,
    }
  })
  const dinilai = hari.filter((h) => !h.nanti)
  const wajib = dinilai.reduce((a, h) => a + h.total, 0)
  const isi = dinilai.reduce((a, h) => a + h.lengkap, 0)
  return {
    hari,
    forms: harian,
    persen: wajib ? Math.round((isi / wajib) * 100) : 0,
    hariLengkap: dinilai.filter((h) => h.total && h.lengkap === h.total).length,
    hariDinilai: dinilai.length,
    temuan: dinilai.reduce((a, h) => a + h.temuan, 0),
  }
}

/** Aktivitas berkala yang jatuh tempo pada `tanggal` dan belum dikerjakan (lintas form). */
export function jatuhTempoAktivitas(forms: string[], recs: OpsRecord[], tanggal: string) {
  const out: { form: string; i: number; item: string; terakhir: string | null; jadwal: string }[] = []
  for (const form of forms) {
    const f = formById(form)
    if (!f || f.periode !== 'harian') continue
    const hariIni = recs.find((r) => r.id === opsId(form, tanggal))
    f.aktivitas.forEach((a, i) => {
      const s = statusJadwal(form, i, tanggal, recs)
      if (s.jadwal === 'harian' || !s.jatuhTempo || (s.selang && s.selang > 365 && !s.terakhir)) return
      if (hariIni?.data.jenis === 'checklist' && hariIni.data.hasil[i]) return
      out.push({ form, i, item: aktivitasRapi(a).item, terakhir: s.terakhir, jadwal: s.jadwal })
    })
  }
  return out
}

/** Form per kategori (housekeeping / perawatan) yang tampil untuk peran ini (fasilitas & database tangki). */
export function formKategori(role: Role, s: Pick<Settings, 'fasilitas'>, k: OpsForm['kategori']) {
  return formTampil(role, s)
    .flatMap((g) => g.forms)
    .filter((id) => formById(id)?.kategori === k)
}
