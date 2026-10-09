/**
 * Proteksi kebakaran SPBU: daftar APAR (alat pemadam api ringan) dan APAB
 * (alat pemadam api berat/beroda) di Pengaturan, dan inspeksi berkala per unit.
 */
import { addDays, todayIso as isoOf } from '@/lib/date'
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
export function statusKedaluwarsa(tgl: string, todayIso: string): 'lewat' | 'segera' | 'ok' | null {
  if (!tgl) return null
  if (tgl < todayIso) return 'lewat'
  return tgl <= isoOf(addDays(new Date(`${todayIso}T00:00:00`), 30)) ? 'segera' : 'ok'
}

/** Pemeriksaan oleh instansi berwenang paling lama 12 bulan sekali. */
export const MASA_INSTANSI_BULAN = 12

/** Batas berlaku pemeriksaan instansi: tanggal periksa + 12 bulan (YYYY-MM-DD). */
export function berlakuInstansi(tglPeriksa: string | undefined) {
  if (!tglPeriksa) return ''
  const [y, m, d] = tglPeriksa.split('-').map(Number)
  const t = new Date(y, m - 1 + MASA_INSTANSI_BULAN, d)
  // 29 Feb / tanggal 31 yang tidak ada di bulan tujuan: pakai akhir bulan itu.
  if (t.getDate() !== d) t.setDate(0)
  return isoOf(t)
}

/** Status pemeriksaan instansi: belum dicatat, lewat, ≤ 30 hari lagi, atau masih berlaku. */
export function statusInstansi(tglPeriksa: string | undefined, todayIso: string): 'belum' | 'lewat' | 'segera' | 'ok' {
  return statusKedaluwarsa(berlakuInstansi(tglPeriksa), todayIso) ?? 'belum'
}

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
