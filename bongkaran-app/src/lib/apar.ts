/**
 * Proteksi kebakaran SPBU: daftar APAR (alat pemadam api ringan) dan APAB
 * (alat pemadam api berat/beroda) di Pengaturan, dan inspeksi berkala per unit.
 */
import { berlakuSertifikat, MASA_SERTIFIKAT_BULAN, statusSertifikat, statusTanggal } from '@/lib/berlaku'
import { genId } from '@/lib/image'
import type { Photo } from '@/lib/sop'

export type AparTipe = 'apar' | 'apab'

export interface AparUnit {
  id: string
  /** Kode/nomor unit pada tabung, mis. "APAR-01". */
  kode: string
  jenis: string
  kapasitasKg: string
  lokasi: string
  /** Unit cadangan (disimpan, belum dipasang). */
  cadangan: boolean
  /** Tanggal isi ulang berikutnya / kedaluwarsa (YYYY-MM-DD). */
  kedaluwarsa: string
  /** Tanggal pemeriksaan terakhir oleh instansi berwenang (YYYY-MM-DD); berlaku maks. 12 bulan. */
  periksaInstansi?: string
  /** Nama instansi pemeriksa, mis. Disnaker atau Damkar. */
  instansi?: string
}

export const APAR_JENIS = ['Powder (DCP)', 'CO2', 'Foam (AFFF)', 'Clean agent'] as const

/** Area awal SPBU (data utama); pengguna dapat menambah atau menghapus area. */
export const DEFAULT_AREAS = [
  'Area tangki pendam / fill pit',
  'Kantor / ruang administrasi',
  'Ruang genset / panel listrik',
  'Kompresor / area servis',
  'Gudang',
  'Minimarket / area umum',
]

export const namaPulau = (n: number) => `Pulau pompa ${n}`

const PREFIX: Record<AparTipe, string> = { apar: 'APAR', apab: 'APAB' }

/** Kode berikutnya yang belum dipakai, mis. APAR-03. */
export function kodeBerikut(tipe: AparTipe, units: AparUnit[]) {
  const pakai = new Set(units.map((u) => u.kode.trim().toUpperCase()))
  for (let n = 1; ; n++) {
    const kode = `${PREFIX[tipe]}-${String(n).padStart(2, '0')}`
    if (!pakai.has(kode)) return kode
  }
}

/** Unit baru dengan nilai awal umum (APAR 6 kg, APAB 50 kg, powder). */
export const unitBaru = (tipe: AparTipe, kode: string, lokasi = ''): AparUnit => ({
  id: genId(tipe),
  kode,
  jenis: APAR_JENIS[0],
  kapasitasKg: tipe === 'apar' ? '6' : '50',
  lokasi,
  cadangan: false,
  kedaluwarsa: '',
})

/** Pilihan lokasi: pulau pompa sesuai jumlah pulau, lalu area dari data utama. */
export function lokasiOptions(jumlahPulau: number, areas: string[] = DEFAULT_AREAS) {
  return [...Array.from({ length: Math.max(0, jumlahPulau) }, (_, i) => namaPulau(i + 1)), ...areas]
}

export type CekKey = 'lokasi' | 'tanda' | 'tekanan' | 'pin' | 'tabung' | 'selang' | 'label' | 'kartu' | 'kedaluwarsa' | 'roda'

/** Butir inspeksi umum APAR/APAB (pemeriksaan bulanan). */
export const CEK_ITEMS: { key: CekKey; label: string; hint?: string; untuk?: AparTipe; aktifSaja?: boolean }[] = [
  { key: 'lokasi', label: 'Terpasang di tempatnya, mudah dijangkau, tidak terhalang', aktifSaja: true },
  { key: 'tanda', label: 'Tanda/label lokasi pemadam terpasang dan terlihat', aktifSaja: true },
  { key: 'tekanan', label: 'Tekanan manometer di zona hijau', hint: 'CO2 tanpa manometer: berat tabung sesuai' },
  { key: 'pin', label: 'Pin pengaman dan segel utuh' },
  { key: 'tabung', label: 'Tabung tidak penyok, berkarat, atau bocor' },
  { key: 'selang', label: 'Selang dan nozzle utuh, tidak retak atau tersumbat' },
  { key: 'label', label: 'Label petunjuk penggunaan terbaca' },
  { key: 'kartu', label: 'Kartu/tag inspeksi terpasang dan diisi' },
  { key: 'kedaluwarsa', label: 'Masa isi ulang/kedaluwarsa masih berlaku' },
  { key: 'roda', label: 'Roda dan troli berfungsi baik', untuk: 'apab' },
]

export const cekUntuk = (tipe: AparTipe, cadangan: boolean) => CEK_ITEMS.filter((c) => (!c.untuk || c.untuk === tipe) && (!c.aktifSaja || !cadangan))

export type CekNilai = 'ok' | 'tidak'

/** Hasil inspeksi satu unit; data unit disalin agar riwayat tetap utuh walau pengaturan berubah. */
export interface AparCek {
  unitId: string
  tipe: AparTipe
  kode: string
  jenis: string
  kapasitasKg: string
  lokasi: string
  cadangan: boolean
  kedaluwarsa: string
  periksaInstansi?: string
  cek: Partial<Record<CekKey, CekNilai>>
  catatan: string
  foto: Photo[]
}

export interface AparData {
  petugas: string
  jam: string
  units: AparCek[]
  catatan: string
  /** Diisi saat inspeksi diselesaikan (semua butir terisi). */
  selesaiAt?: string
}

/** Record lama: satu inspeksi untuk semua unit per tanggal. */
export const aparRecordId = (tanggal: string) => `apar_${tanggal}`
/** Inspeksi per unit (dikirim di lokasi unit setelah pindai QR): satu record per unit per tanggal. */
export const aparUnitRecordId = (tanggal: string, unitId: string) => `apar_${tanggal}_${unitId}`

/** Cari unit dari kode yang diketik (label QR rusak), tanpa beda huruf besar/kecil & spasi. */
export function unitDariKode(kode: string, units: AparUnit[]) {
  const k = kode.trim().toUpperCase().replace(/\s+/g, '')
  return k ? (units.find((u) => u.kode.trim().toUpperCase().replace(/\s+/g, '') === k) ?? null) : null
}

export function cekDari(u: AparUnit, tipe: AparTipe): AparCek {
  return { unitId: u.id, tipe, kode: u.kode, jenis: u.jenis, kapasitasKg: u.kapasitasKg, lokasi: u.lokasi, cadangan: u.cadangan, kedaluwarsa: u.kedaluwarsa, periksaInstansi: u.periksaInstansi ?? '', cek: {}, catatan: '', foto: [] }
}

/** Butir yang belum diisi, dan butir yang ditandai "Tidak" (temuan). */
export function hasilCek(c: AparCek) {
  const items = cekUntuk(c.tipe, c.cadangan)
  const kosong = items.filter((i) => !c.cek[i.key])
  const temuan = items.filter((i) => c.cek[i.key] === 'tidak')
  return { items, kosong, temuan }
}

/** Kedaluwarsa sudah lewat (atau dalam 30 hari). */
export const statusKedaluwarsa = statusTanggal

/** Pemeriksaan oleh instansi berwenang paling lama 12 bulan sekali. */
export const MASA_INSTANSI_BULAN = MASA_SERTIFIKAT_BULAN
/** Batas berlaku pemeriksaan instansi: tanggal periksa + 12 bulan (YYYY-MM-DD). */
export const berlakuInstansi = berlakuSertifikat
/** Status pemeriksaan instansi: belum dicatat, lewat, ≤ 30 hari lagi, atau masih berlaku. */
export const statusInstansi = statusSertifikat

export type StatusUnit = 'baik' | 'temuan' | 'belum'

/** Riwayat pemeriksaan satu unit (terbaru dulu): hanya isian yang semua butirnya terisi. */
export function riwayatUnit(unitId: string, records: { tanggal: string; data: AparData }[]) {
  return records
    .flatMap((r) => {
      const c = r.data.units.find((u) => u.unitId === unitId)
      if (!c || hasilCek(c).kosong.length) return []
      const temuan = hasilCek(c).temuan.map((t) => t.label)
      return [{ tanggal: r.tanggal, cek: c, selesai: !!r.data.selesaiAt, petugas: r.data.petugas, temuan, status: (temuan.length ? 'temuan' : 'baik') as StatusUnit }]
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
}

export interface KondisiUnit {
  unit: AparUnit
  tipe: AparTipe
  terakhir: ReturnType<typeof riwayatUnit>[number] | null
  status: StatusUnit
  /** Sudah diperiksa pada bulan berjalan. */
  bulanIni: boolean
  isiUlang: ReturnType<typeof statusKedaluwarsa>
  /** Pemeriksaan instansi berwenang (maks. 12 bulan). */
  instansi: ReturnType<typeof statusInstansi>
}

/** Kondisi terkini semua unit dari data utama, untuk dashboard dan halaman unit. */
export function kondisiSemua(s: { apar?: AparUnit[]; apab?: AparUnit[] }, records: { tanggal: string; data: AparData }[], today: string): KondisiUnit[] {
  const units = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))]
  return units.map(({ u, tipe }) => {
    const terakhir = riwayatUnit(u.id, records)[0] ?? null
    return {
      unit: u,
      tipe,
      terakhir,
      status: terakhir ? terakhir.status : 'belum',
      bulanIni: !!terakhir && terakhir.tanggal.startsWith(today.slice(0, 7)),
      isiUlang: statusKedaluwarsa(u.kedaluwarsa, today),
      instansi: statusInstansi(u.periksaInstansi, today),
    }
  })
}

export const tipeLabel = (tipe: AparTipe, cadangan: boolean) => (tipe === 'apab' ? 'APAB' : cadangan ? 'APAR cadangan' : 'APAR')

/** Tautan yang disimpan di QR label: membuka halaman data & kondisi unit. */
export const aparUnitUrl = (id: string, origin = window.location.origin) => `${origin}/apar/unit/${encodeURIComponent(id)}`

/** Ambil id unit dari isi QR (URL label FLOQ), atau null bila bukan label APAR. */
export function unitIdDariQr(text: string) {
  const m = text.trim().match(/\/apar\/unit\/([^/?#\s]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Unit dari hasil pindai: URL label QR FLOQ (…/apar/unit/<id>), atau teks berisi kode unit
 * (mis. barcode/QR lama yang hanya memuat "APAR-01").
 */
export function unitDariPindai(text: string, units: AparUnit[]): { unit: AparUnit | null; pesan: string | null } {
  const id = unitIdDariQr(text)
  if (id) {
    const unit = units.find((u) => u.id === id) ?? null
    return { unit, pesan: unit ? null : 'Unit pada label ini sudah tidak terdaftar di data utama.' }
  }
  const unit = unitDariKode(text, units)
  return { unit, pesan: unit ? null : 'QR/barcode ini bukan label APAR/APAB FLOQ. Ketik kode unit bila label rusak.' }
}

export const NAMA_BULAN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']

/**
 * Status kepatuhan inspeksi per bulan:
 * baik / temuan = sudah diinspeksi; terlewat = bulan lalu tanpa inspeksi;
 * berjalan = bulan ini, belum diinspeksi; nanti = bulan mendatang; sebelum = sebelum unit terdaftar.
 */
export type StatusBulan = 'baik' | 'temuan' | 'terlewat' | 'berjalan' | 'nanti' | 'sebelum'

export interface BulanKepatuhan {
  bulan: number
  status: StatusBulan
  /** Inspeksi terakhir pada bulan itu. */
  inspeksi: ReturnType<typeof riwayatUnit>[number] | null
}

/** Bulan unit terdaftar (YYYY-MM) dari id unit (genId memuat waktu pembuatan), atau null. */
export function bulanTerdaftar(unitId: string) {
  const ms = Number(unitId.split('_')[1])
  if (!Number.isFinite(ms) || ms < 1e12) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Kalender kepatuhan inspeksi bulanan satu unit pada satu tahun. */
export function kepatuhanBulanan(unitId: string, records: { tanggal: string; data: AparData }[], tahun: number, todayIso: string) {
  const riwayat = riwayatUnit(unitId, records)
  const bulanIni = todayIso.slice(0, 7)
  const pertama = riwayat.at(-1)?.tanggal.slice(0, 7)
  const daftar = [bulanTerdaftar(unitId), pertama].filter((x): x is string => !!x).sort()[0] ?? bulanIni
  const bulan: BulanKepatuhan[] = NAMA_BULAN.map((_, i) => {
    const ym = `${tahun}-${String(i + 1).padStart(2, '0')}`
    const inspeksi = riwayat.find((r) => r.tanggal.startsWith(ym)) ?? null
    const status: StatusBulan = inspeksi ? inspeksi.status === 'temuan' ? 'temuan' : 'baik' : ym > bulanIni ? 'nanti' : ym < daftar ? 'sebelum' : ym === bulanIni ? 'berjalan' : 'terlewat'
    return { bulan: i, status, inspeksi }
  })
  // Kepatuhan dihitung dari bulan wajib yang sudah lewat atau berjalan (bulan berjalan dihitung bila sudah diinspeksi).
  const wajib = bulan.filter((b) => b.status === 'baik' || b.status === 'temuan' || b.status === 'terlewat')
  const patuh = wajib.filter((b) => b.status !== 'terlewat').length
  return { bulan, wajib: wajib.length, patuh }
}
