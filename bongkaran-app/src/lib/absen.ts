/**
 * Absensi personil SPBU: masuk, istirahat (mulai/selesai, boleh beberapa kali), dan keluar. Setiap
 * absen wajib memindai QR absensi SPBU (dipasang di lokasi, isi "FLOQ-ABSEN|<id SPBU>|<token>") dan
 * lokasi GPS di dalam radius titik absensi SPBU. Satu catatan per personil per tanggal masuk
 * (tabel bbm_absen, id "<tanggal>_<id personil>"); shift 3 keluar keesokan pagi tetap di catatan masuk.
 * Di Supabase jam dicatat server dan QR/jarak diperiksa ulang oleh RPC bbm_absen.
 */
import type { Catatan } from '@/lib/catatan'
import { todayIso } from '@/lib/date'
import type { KodeJadwal } from '@/lib/personil'
import type { Personil } from '@/lib/sop'

export type JenisAbsen = 'masuk' | 'istirahat' | 'kembali' | 'keluar'
export const LABEL_ABSEN: Record<JenisAbsen, string> = { masuk: 'Absen masuk', istirahat: 'Mulai istirahat', kembali: 'Selesai istirahat', keluar: 'Absen keluar' }

export interface TitikAbsen {
  /** Waktu absen (ISO, jam server di Supabase). */
  at: string
  lat: number
  lng: number
  /** Akurasi GPS (m). */
  akurasi: number
  /** Jarak ke titik absensi SPBU (m). */
  jarak: number
  /** Akun yang melakukan absen (bisa HP personil sendiri atau HP kepala shift). */
  oleh: string | null
  olehNama: string
}

export interface AbsenData {
  personilId: string
  nama: string
  jabatan: string
  masuk: TitikAbsen
  istirahat: { mulai: TitikAbsen; selesai?: TitikAbsen }[]
  keluar?: TitikAbsen
}
export type AbsenRecord = Catatan<AbsenData>

/** Pengaturan absensi SPBU (settings.absensi), diatur ABH/pengawas. */
export interface AbsensiSetting {
  lat: number | null
  lng: number | null
  /** Radius area absensi (m). */
  radius: number
  /** Token QR; diganti bila QR lama perlu dinonaktifkan. */
  token: string
}
export const RADIUS_BAWAAN = 100
/** Toleransi akurasi GPS yang diperhitungkan (m). */
export const AKURASI_MAKS = 50
/** Batas catatan masuk dianggap masih terbuka (shift 3 keluar keesokan pagi). */
const JAM_TERBUKA = 20

export const tokenBaru = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')
export const teksQr = (spbuId: string, token: string) => `FLOQ-ABSEN|${spbuId}|${token}`
export const idAbsen = (tanggal: string, personilId: string) => `${tanggal}_${personilId}`

/** Jarak dua koordinat (m), rumus haversine. */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (x: number) => (x * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

export const absensiSiap = (a: AbsensiSetting | undefined): a is AbsensiSetting & { lat: number; lng: number } => !!a?.token && a.lat !== null && a.lng !== null

/** Posisi GPS terhadap area absensi: di dalam bila jarak − akurasi (maks. 50 m) ≤ radius. */
export function cekArea(a: AbsensiSetting & { lat: number; lng: number }, pos: { lat: number; lng: number; akurasi: number }) {
  const jarak = jarakMeter(a.lat, a.lng, pos.lat, pos.lng)
  return { jarak, ok: jarak - Math.min(pos.akurasi, AKURASI_MAKS) <= a.radius }
}

export type StatusAbsen = 'belum' | 'bekerja' | 'istirahat' | 'pulang'
export function statusAbsen(d: AbsenData | undefined): StatusAbsen {
  if (!d) return 'belum'
  if (d.keluar) return 'pulang'
  const t = d.istirahat.at(-1)
  return t && !t.selesai ? 'istirahat' : 'bekerja'
}
export const AKSI: Record<StatusAbsen, JenisAbsen[]> = { belum: ['masuk'], bekerja: ['istirahat', 'keluar'], istirahat: ['kembali', 'keluar'], pulang: [] }

/** Catatan masuk personil yang belum keluar (≤ 20 jam lalu). */
export function catatanTerbuka(recs: AbsenRecord[], personilId: string, now = new Date()) {
  return recs
    .filter((r) => r.data.personilId === personilId && !r.data.keluar && now.getTime() - Date.parse(r.data.masuk.at) < JAM_TERBUKA * 3600_000)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0]
}

/**
 * Terapkan satu absen (dipakai mode lokal; aturan sama dengan RPC bbm_absen). Mengembalikan catatan
 * baru/yang diubah, atau melempar Error berisi alasan penolakan.
 */
export function prosesAbsen(recs: AbsenRecord[], p: Personil, jenis: JenisAbsen, titik: TitikAbsen, tanggal: string, now = new Date()): AbsenRecord {
  const buka = catatanTerbuka(recs, p.id, now)
  const t = now.getTime()
  if (jenis === 'masuk') {
    if (buka) throw new Error(`${p.nama} sudah absen masuk dan belum absen keluar.`)
    if (recs.some((r) => r.id === idAbsen(tanggal, p.id))) throw new Error(`${p.nama} sudah absen masuk & keluar pada tanggal ini.`)
    return { id: idAbsen(tanggal, p.id), tanggal, shift: 0, data: { personilId: p.id, nama: p.nama, jabatan: p.jabatan, masuk: titik, istirahat: [] }, createdAt: t, updatedAt: t, createdBy: titik.oleh }
  }
  if (!buka) throw new Error(`${p.nama} belum absen masuk.`)
  const d: AbsenData = { ...buka.data, istirahat: buka.data.istirahat.map((x) => ({ ...x })) }
  const st = statusAbsen(d)
  if (jenis === 'istirahat') {
    if (st === 'istirahat') throw new Error(`${p.nama} sedang istirahat.`)
    d.istirahat.push({ mulai: titik })
  } else if (jenis === 'kembali') {
    if (st !== 'istirahat') throw new Error(`${p.nama} belum mulai istirahat.`)
    d.istirahat[d.istirahat.length - 1].selesai = titik
  } else {
    if (st === 'istirahat') d.istirahat[d.istirahat.length - 1].selesai = titik
    d.keluar = titik
  }
  return { ...buka, data: d, updatedAt: t }
}

const menit = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000))
/** Total menit istirahat (istirahat berjalan dihitung sampai `now`). */
export const menitIstirahat = (d: AbsenData, now = new Date()) => d.istirahat.reduce((n, x) => n + menit(x.mulai.at, x.selesai?.at ?? now.toISOString()), 0)
/** Menit kerja bersih = masuk s.d. keluar (atau sekarang) − istirahat. */
export const menitKerja = (d: AbsenData, now = new Date()) => Math.max(0, menit(d.masuk.at, d.keluar?.at ?? now.toISOString()) - menitIstirahat(d, now))
export const labelMenit = (m: number) => (m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} j ${String(m % 60).padStart(2, '0')} mnt`)
export const jamDari = (iso: string | undefined) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':') : '-')

/** Jam mulai shift jadwal. */
const MULAI_SHIFT: Record<string, string> = { '1': '06:00', '2': '14:00', '3': '22:00' }
/** Keterlambatan (menit) terhadap jam mulai shift jadwal; null bila tidak terjadwal shift. */
export function menitTerlambat(d: AbsenData, kode: KodeJadwal | undefined, tanggal: string) {
  const mulai = kode ? MULAI_SHIFT[kode] : undefined
  if (!mulai) return null
  const jadwal = new Date(`${tanggal}T${mulai}:00`)
  return Math.max(0, Math.round((Date.parse(d.masuk.at) - jadwal.getTime()) / 60000))
}

/** Tanggal absen masuk = tanggal perangkat saat ini. */
export const tanggalAbsen = (now = new Date()) => todayIso(now)
