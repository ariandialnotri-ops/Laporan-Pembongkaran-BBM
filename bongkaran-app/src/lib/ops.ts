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

export const formById = (id: string) => OPS_FORMS.find((f) => f.id === id)

/** Kelompok tampilan di menu Operasional. */
export const OPS_GRUP: { judul: string; forms: string[] }[] = [
  { judul: 'Pompa & tangki', forms: ['pompa-dorong', 'tangki-dorong', 'pompa-tangki-rutin'] },
  { judul: 'Peralatan', forms: ['apar-harian', 'panel-listrik', 'genset'] },
  { judul: 'Kanopi, totem & outlet', forms: ['totem', 'kanopi-pompa', 'outlet-ritel'] },
  { judul: 'Housekeeping', forms: OPS_FORMS.filter((f) => f.kategori === 'hk').map((f) => f.id) },
  { judul: 'Pantauan lingkungan', forms: [FORM_SUMUR, FORM_OIL] },
]

export const judulForm = (id: string) => (id === FORM_SUMUR ? 'Sumur Pantau' : id === FORM_OIL ? 'Oil Catcher' : (formById(id)?.judul ?? id))
const fasilitasForm = (id: string) => (id === FORM_SUMUR ? 'sumurPantau' : id === FORM_OIL ? 'oilCatcher' : (formById(id)?.fasilitas ?? null))

/** Siapa mengisi form apa (sama dengan aturan bbm_ops di database). */
export function bolehIsi(role: Role, form: string) {
  if (role === 'abh' || role === 'pengawas') return true
  if (form.startsWith('hk-')) return role === 'cs'
  if (form === FORM_SUMUR || form === FORM_OIL) return role === 'kashift' || role === 'security'
  return role === 'kashift'
}
export const bolehParaf = (role: Role) => role === 'abh' || role === 'pengawas'

/** Form yang tampil untuk peran ini di SPBU ini, per kelompok. */
export function formTampil(role: Role, s: Pick<Settings, 'fasilitas'>) {
  return OPS_GRUP.map((g) => ({ ...g, forms: g.forms.filter((id) => bolehIsi(role, id) && punyaFasilitas(s, fasilitasForm(id))) })).filter((g) => g.forms.length)
}

/** Nama aktivitas tanpa nomor catatan kaki; "Bagian · aktivitas" dipisah. */
export function aktivitasRapi(nama: string) {
  const bersih = nama.replace(/\s*\d\)\s*$/, '').trim()
  const [bagian, item] = bersih.includes(' · ') ? bersih.split(' · ') : ['', bersih]
  // Format asli sebagian berhuruf kapital semua: dijadikan huruf kalimat, singkatan dipertahankan.
  const kalimat = item === item.toUpperCase() ? item.toLowerCase().replace(/\b(apar|apab|bbm|bbk|ac|atg|buh)\b/g, (m) => m.toUpperCase()) : item
  return { bagian, item: kalimat.charAt(0).toUpperCase() + kalimat.slice(1) }
}

/** Jadwal aktivitas (dari catatan kaki format asli). */
export function jadwal(nama: string) {
  const t = nama.toLowerCase()
  if (t.includes('ganti oli')) return 'tiap 100 jam / bulanan'
  if (t.includes('cuci sajadah')) return 'sebulan sekali'
  if (t.includes('panaskan mesin')) return '3 hari sekali'
  if (t.includes('flow rate') || t.includes('pemeriksaan fungsi')) return 'sebulan sekali'
  if (['filter', 'bersihkan totem', 'bersihkan kanopi', 'cuci driveway', 'cuci kanopi', 'kuras', 'keset', 'penambahan gemuk', 'mencuci'].some((k) => t.includes(k))) return 'seminggu sekali'
  return 'harian'
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
