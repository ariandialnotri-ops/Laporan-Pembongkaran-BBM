/**
 * Pelaporan insiden, near miss, dan kerusakan SPBU. Disimpan di bbm_daily (kind 'insiden'),
 * satu record per laporan; tindak lanjut ditambahkan ke riwayat laporan yang sama.
 */
import type { DailyRecord, InsidenRecord } from '@/lib/daily'
import { PRODUK_OPTIONS, type Photo, type Settings } from '@/lib/sop'

/** 'henti' = laporan stop penyaluran (menu tersendiri, bukan bagian laporan kerusakan). */
export type JenisInsiden = 'insiden' | 'nearmiss' | 'kerusakan' | 'henti'
export type TingkatInsiden = 'rendah' | 'sedang' | 'tinggi'
export type StatusInsiden = 'terbuka' | 'proses' | 'selesai'

export const JENIS_INSIDEN: { value: JenisInsiden; label: string; desc: string }[] = [
  { value: 'insiden', label: 'Insiden', desc: 'Menimbulkan cedera, api, tumpahan BBM, atau kerugian' },
  { value: 'nearmiss', label: 'Near miss', desc: 'Hampir celaka, belum menimbulkan kerugian' },
  { value: 'kerusakan', label: 'Kerusakan', desc: 'Peralatan atau fasilitas SPBU rusak' },
]

/** Stop penyaluran: dilaporkan lewat menu Operation > Stop Penyaluran, tidak ikut daftar jenis kejadian HSSE. */
export const JENIS_HENTI = { value: 'henti' as const, label: 'Stop penyaluran', desc: 'Penyaluran produk dihentikan sementara (kerusakan, kualitas, stok habis, listrik, instruksi)' }

export const KATEGORI_INSIDEN: Record<JenisInsiden, string[]> = {
  insiden: ['Cedera / kecelakaan kerja', 'Kebakaran / api', 'Tumpahan / kebocoran BBM', 'Kecelakaan kendaraan di area SPBU', 'Keamanan / pencurian', 'Lainnya'],
  nearmiss: ['Hampir tertabrak / terpeleset', 'Sumber api / merokok di area', 'Hampir tumpah saat bongkar / pengisian', 'Perilaku tidak aman', 'Kondisi tidak aman', 'Lainnya'],
  kerusakan: ['Dispenser / nozzle', 'Tangki pendam / ATG', 'Listrik / genset / panel', 'Bangunan / kanopi', 'APAR / proteksi kebakaran', 'Lainnya'],
  henti: ['Kerusakan dispenser / nozzle', 'Kualitas BBM tidak sesuai', 'Stok habis / dry out', 'Kendala pengiriman dari Depot / Fuel Terminal', 'Pemadaman listrik', 'Perbaikan / tera ulang', 'Instruksi Pertamina / manajemen', 'Lainnya'],
}

export const TINGKAT_INSIDEN: { value: TingkatInsiden; label: string }[] = [
  { value: 'rendah', label: 'Rendah' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'tinggi', label: 'Tinggi' },
]

export const STATUS_INSIDEN: { value: StatusInsiden; label: string; tone: 'error' | 'neutral' | 'success' }[] = [
  { value: 'terbuka', label: 'Terbuka', tone: 'error' },
  { value: 'proses', label: 'Ditindaklanjuti', tone: 'neutral' },
  { value: 'selesai', label: 'Selesai', tone: 'success' },
]

export interface InsidenLangkah {
  at: string
  oleh: string
  status: StatusInsiden
  catatan: string
  /** Foto tindak lanjut (perbaikan, kondisi setelah ditangani). */
  foto?: Photo[]
  /** Berita acara / dokumen pendukung (foto dokumen atau PDF). */
  ba?: Photo[]
}

/** Pemberhentian penyaluran sementara karena kerusakan (produk yang tidak dapat disalurkan). */
export interface HentiPenyaluran {
  produk: string[]
  /** Mulai berhenti, "YYYY-MM-DDTHH:mm" waktu lokal. */
  mulai: string
  /** Penyaluran dibuka kembali; kosong = masih berhenti. */
  selesai?: string
}

export interface InsidenData {
  jenis: JenisInsiden
  kategori: string
  jam: string
  lokasi: string
  /** Peralatan yang terlibat/rusak (mis. Nozzle 2, Dispenser 1). */
  aset: string
  uraian: string
  penyebab: string
  tindakanSegera: string
  /** Korban / dampak (insiden). */
  dampak: string
  tingkat: TingkatInsiden
  pelapor: string
  foto: Photo[]
  /** Video bercap waktu dari kamera Lapor (maks. 1, 30 detik). */
  video?: Photo[]
  status: StatusInsiden
  pic: string
  targetSelesai: string
  riwayat: InsidenLangkah[]
  /** Laporan stop penyaluran (jenis 'henti'); laporan kerusakan lama juga dapat memuatnya. */
  henti?: HentiPenyaluran
}

export const jenisLabel = (j: JenisInsiden) => (j === 'henti' ? JENIS_HENTI.label : (JENIS_INSIDEN.find((x) => x.value === j)?.label ?? j))
export const statusMeta = (s: StatusInsiden) => STATUS_INSIDEN.find((x) => x.value === s) ?? STATUS_INSIDEN[0]

/** "YYYY-MM-DDTHH:mm" waktu lokal sekarang. */
export function waktuLokal(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Lama berhenti, mis. "3 jam 20 menit" / "2 hari 4 jam". */
export function durasiHenti(h: HentiPenyaluran, sekarang = waktuLokal()) {
  const ms = Date.parse(h.selesai || sekarang) - Date.parse(h.mulai)
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const menit = Math.round(ms / 60000)
  const hari = Math.floor(menit / 1440)
  const jam = Math.floor((menit % 1440) / 60)
  const sisa = menit % 60
  return hari ? `${hari} hari ${jam} jam` : jam ? `${jam} jam ${sisa} menit` : `${sisa} menit`
}

/** "17 Okt 2026 08:30" dari "YYYY-MM-DDTHH:mm". */
export const labelWaktu = (w: string | undefined, fmt: (iso: string) => string) => (w ? `${fmt(w.slice(0, 10))} ${w.slice(11, 16)}` : '-')

/** Lama berhenti dalam menit (masih berhenti dihitung sampai sekarang). */
export function menitHenti(h: HentiPenyaluran, sekarang = waktuLokal()) {
  const ms = Date.parse(h.selesai || sekarang) - Date.parse(h.mulai)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0
}

/** "5 jam 20 menit" dari menit. */
export function labelMenit(menit: number) {
  const hari = Math.floor(menit / 1440)
  const jam = Math.floor((menit % 1440) / 60)
  const sisa = menit % 60
  return hari ? `${hari} hari ${jam} jam` : jam ? `${jam} jam ${sisa} menit` : `${sisa} menit`
}

/** Produk yang disalurkan SPBU ini (dari database nozzle), bawaan semua produk. */
export function produkSpbu(s: Pick<Settings, 'nozzles'>) {
  const ada = [...new Set((s.nozzles ?? []).map((n) => n.produk).filter(Boolean))]
  return ada.length ? PRODUK_OPTIONS.filter((p) => ada.includes(p)).concat(ada.filter((p) => !PRODUK_OPTIONS.includes(p))) : PRODUK_OPTIONS
}

/** Lokasi stop penyaluran di luar SPBU: pasokan terlambat / tidak terkirim dari Depot / Fuel Terminal. */
export const LOKASI_DEPOT = 'Kendala pengiriman dari Depot / Fuel Terminal'

export interface HentiItem {
  id: string
  tanggal: string
  alasan: string
  h: HentiPenyaluran
}

/**
 * Ringkasan stop penyaluran untuk dashboard: yang masih berhenti, dan per bulan (berdasar mulai berhenti)
 * jumlah kejadian, total & rata-rata lama berhenti, serta rincian per produk.
 */
export function ringkasHenti(items: HentiItem[], bulan: string, sekarang = waktuLokal()) {
  const aktif = items.filter((x) => !x.h.selesai).sort((a, b) => a.h.mulai.localeCompare(b.h.mulai))
  const bulanIni = items.filter((x) => x.h.mulai.startsWith(bulan))
  const totalMenit = bulanIni.reduce((n, x) => n + menitHenti(x.h, sekarang), 0)
  const selesai = bulanIni.filter((x) => x.h.selesai)
  const rataMenit = selesai.length ? Math.round(selesai.reduce((n, x) => n + menitHenti(x.h, sekarang), 0) / selesai.length) : 0
  const produk = [...new Set(bulanIni.flatMap((x) => x.h.produk))].map((p) => {
    const xs = bulanIni.filter((x) => x.h.produk.includes(p))
    return { produk: p, kejadian: xs.length, menit: xs.reduce((n, x) => n + menitHenti(x.h, sekarang), 0), berhenti: aktif.some((x) => x.h.produk.includes(p)) }
  })
  produk.sort((a, b) => b.menit - a.menit)
  const alasan = [...new Set(bulanIni.map((x) => x.alasan))].map((a) => ({ alasan: a, kejadian: bulanIni.filter((x) => x.alasan === a).length })).sort((a, b) => b.kejadian - a.kejadian)
  return { aktif, kejadian: bulanIni.length, totalMenit, rataMenit, produk, alasan }
}

/** Semua pemberhentian penyaluran (laporan stop penyaluran + laporan kerusakan lama yang memuatnya). */
export const hentiDari = (daily: DailyRecord[]): HentiItem[] =>
  daily
    .filter((d): d is InsidenRecord => d.kind === 'insiden' && !!d.data.henti)
    .map((r) => ({ id: r.id, tanggal: r.tanggal, alasan: r.data.kategori, h: r.data.henti! }))
