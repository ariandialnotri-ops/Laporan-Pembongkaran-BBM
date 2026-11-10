/**
 * Guard Tour System (GTS): sampling subsidi tepat oleh security. Hari operasional (06:00-05:59) dibagi
 * 12 slot 2 jam; tiap slot minimal 1 transaksi JBT (Biosolar) dan 1 JBKP (Pertalite), masing-masing
 * dengan foto EDC, struk, dan kendaraan dengan nomor polisi terlihat.
 *
 * Hemat penyimpanan: foto hanya diolah di HP (cap waktu & nama SPBU) lalu dikirim ke WhatsApp bersama
 * teks laporan; yang disimpan di database hanya isian form.
 */
import { addDays, todayIso } from '@/lib/date'
import type { Shift } from '@/lib/shift'
import type { Photo, Settings } from '@/lib/sop'
import type { StatusIsi } from '@/lib/status-isi'

export type JenisGts = 'JBT' | 'JBKP'
export const JENIS_GTS: { value: JenisGts; label: string; produk: string; desc: string }[] = [
  { value: 'JBT', label: 'JBT', produk: 'Biosolar', desc: 'Jenis BBM Tertentu (solar subsidi)' },
  { value: 'JBKP', label: 'JBKP', produk: 'Pertalite', desc: 'Jenis BBM Khusus Penugasan' },
]
export const jenisGts = (j: JenisGts) => JENIS_GTS.find((x) => x.value === j)!

export type FotoGtsKey = 'edc' | 'struk' | 'kendaraan'
export const FOTO_GTS: { key: FotoGtsKey; label: string; hint: string }[] = [
  { key: 'edc', label: 'Foto EDC', hint: 'Layar mesin EDC saat transaksi (QR/MyPertamina).' },
  { key: 'struk', label: 'Foto struk', hint: 'Struk transaksi terbaca: produk, liter, harga.' },
  { key: 'kendaraan', label: 'Foto kendaraan', hint: 'Kendaraan di depan dispenser, nomor polisi terlihat jelas.' },
]

export type SesuaiGts = 'Sesuai' | 'Tidak sesuai'

export interface GtsData {
  nopol: string
  produk: string
  /** Mis. Motor, Kijang, Pick up, Truk. */
  jenisKendaraan?: string
  liter: string
  jam: string
  shift?: Shift
  petugas: string
  sesuai?: SesuaiGts
  /** Alasan bila tidak sesuai ketentuan. */
  keterangan?: string
  catatan: string
  /** Hanya catatan lama (sebelum foto dikirim lewat WhatsApp); catatan baru tanpa foto. */
  foto?: Partial<Record<FotoGtsKey, Photo[]>>
}

export const JENIS_KENDARAAN = ['Motor', 'Mobil pribadi', 'Kijang', 'Pick up', 'Truk', 'Bus', 'Angkot', 'Bajaj / roda tiga']

export interface GtsRecord {
  id: string
  tanggal: string
  /** 0 = 06:00-07:59 ... 11 = 04:00-05:59. */
  slot: number
  jenis: JenisGts
  data: GtsData
  createdAt: number
  createdBy: string | null
}

export const JUMLAH_SLOT = 12
const pad = (n: number) => String(n).padStart(2, '0')
/** Jam mulai slot (06, 08, ..., 04). */
export const jamMulaiSlot = (slot: number) => (6 + slot * 2) % 24
export const labelSlot = (slot: number) => `${pad(jamMulaiSlot(slot))}:00 - ${pad((jamMulaiSlot(slot) + 1) % 24)}:59`

/** Slot berjalan & tanggal operasionalnya (00:00-05:59 masih hari operasional sebelumnya). */
export function slotKini(now = new Date()) {
  const h = now.getHours()
  const tanggal = h < 6 ? todayIso(addDays(now, -1)) : todayIso(now)
  return { tanggal, slot: Math.floor((((h - 6) % 24) + 24) % 24 / 2) }
}

/** Status slot: hijau = JBT & JBKP lengkap, oranye = slot berjalan belum lengkap, merah = slot lewat belum lengkap. */
export function statusSlot(tanggal: string, slot: number, recs: GtsRecord[], now = slotKini()): StatusIsi {
  const isi = recs.filter((r) => r.tanggal === tanggal && r.slot === slot)
  if (isi.some((r) => r.jenis === 'JBT') && isi.some((r) => r.jenis === 'JBKP')) return 'sudah'
  const a = `${tanggal}#${pad(slot)}`
  const b = `${now.tanggal}#${pad(now.slot)}`
  return a < b ? 'terlewat' : a === b ? 'belum' : 'nanti'
}

export const gtsId = () => `gts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
/** "16 Oktober 2026". */
export const tanggalPanjang = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

/** "SPBU COCO 5164407 Nganjuk": kode SPBU disisipkan setelah jenis SPBU bila belum ada di nama. */
export function namaSpbuWa(s: Pick<Settings, 'namaSpbu' | 'kodeSpbu'>) {
  const nama = (s.namaSpbu || 'SPBU').trim()
  const kode = (s.kodeSpbu || '').trim()
  if (!kode || nama.includes(kode)) return nama
  const m = nama.match(/^(SPBU(?:\s+(?:COCO|CODO|DODO))?)\s*(.*)$/i)
  return m ? [m[1], kode, m[2]].filter(Boolean).join(' ') : `${nama} ${kode}`
}

/**
 * Teks laporan WhatsApp satu sampling. Isian dalam blok monospace WhatsApp (```) supaya titik dua
 * sejajar di semua HP; judul tebal (*...*).
 */
export function teksWaGts(rec: Pick<GtsRecord, 'jenis' | 'data'>, s: Pick<Settings, 'namaSpbu' | 'kodeSpbu'>, tanggalKalender: string, zona = '') {
  const d = rec.data
  const baris: [string, string][] = [
    ['Shift', d.shift ? String(d.shift) : '-'],
    ['Petugas', d.petugas || '-'],
    ['Jenis Penyaluran', rec.jenis],
    ['Nopol Kendaraan', d.nopol || '-'],
    ['Jenis Kendaraan', d.jenisKendaraan || '-'],
    ['Volume Pembelian', d.liter ? `${d.liter} L` : '-'],
    ['Sesuai Ketentuan', d.sesuai ?? 'Sesuai'],
  ]
  if (d.sesuai === 'Tidak sesuai' && d.keterangan) baris.push(['Keterangan', d.keterangan])
  const lebar = Math.max(...baris.map(([k]) => k.length))
  return [
    '*Laporan Sampling Penyaluran Subsidi Tepat JBT/JBKP*',
    namaSpbuWa(s),
    `Tanggal ${tanggalPanjang(tanggalKalender)}, ${d.jam}${zona ? ` ${zona}` : ''}`,
    '',
    '```',
    ...baris.map(([k, v]) => `${k.padEnd(lebar)} : ${v}`),
    '```',
  ].join('\n')
}
