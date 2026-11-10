import { prosesStore } from '@/lib/proses'

/**
 * Pelacak ekspor / unduh file (PDF, Excel, JPG, ZIP) untuk lembar progres global berpersentase.
 * Pemanggil membungkus pekerjaannya dengan `ekspor(judul, async (lapor) => ...)` dan melaporkan
 * tahap nyata (mis. foto ke-3 dari 12). Di antara laporan, lembar merambat pelan sendiri agar
 * pengguna tahu aplikasi tidak macet.
 */
export type Lapor = (persen: number, tahap?: string) => void

export interface KeadaanEkspor {
  fase: 'diam' | 'proses' | 'sukses' | 'gagal'
  judul: string
  tahap: string
  /** Persentase nyata terakhir yang dilaporkan (0-100). */
  persen: number
  /** Waktu mulai (ms) untuk penghitung durasi. */
  mulai: number
  pesan: string
}

const KOSONG: KeadaanEkspor = { fase: 'diam', judul: '', tahap: '', persen: 0, mulai: 0, pesan: '' }
let keadaan = KOSONG
const pendengar = new Set<() => void>()
let tundaTutup: ReturnType<typeof setTimeout> | null = null

const ubah = (patch: Partial<KeadaanEkspor>) => {
  keadaan = { ...keadaan, ...patch }
  pendengar.forEach((f) => f())
}

export const eksporStore = {
  subscribe(f: () => void) {
    pendengar.add(f)
    return () => pendengar.delete(f)
  },
  get: () => keadaan,
  tutup: () => {
    if (tundaTutup) clearTimeout(tundaTutup)
    tundaTutup = null
    // Simpan otomatis sebelum ekspor sudah tercakup lembar ini; jangan munculkan "Berhasil!" sesudahnya.
    if (prosesStore.get().fase === 'sukses') prosesStore.tutup()
    keadaan = KOSONG
    pendengar.forEach((f) => f())
  },
}

const pesanGalat = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Beri kesempatan browser menggambar lembar sebelum pekerjaan berat (canvas/PDF) memblokir thread. */
const jeda = () => new Promise<void>((r) => setTimeout(r, 30))

/** Jalankan ekspor dengan lembar progres. Galat tetap dilempar ulang agar halaman dapat menampilkan pesannya. */
export async function ekspor<T>(judul: string, fn: (lapor: Lapor) => Promise<T>): Promise<T> {
  // Ekspor bersarang memakai lembar yang sama.
  if (keadaan.fase === 'proses') return fn(laporKe)
  if (tundaTutup) clearTimeout(tundaTutup)
  tundaTutup = null
  ubah({ ...KOSONG, fase: 'proses', judul, tahap: 'Menyiapkan…', persen: 2, mulai: Date.now() })
  await jeda()
  try {
    const hasil = await fn(laporKe)
    ubah({ fase: 'sukses', persen: 100, tahap: 'File sedang diunduh ke perangkat Anda' })
    tundaTutup = setTimeout(eksporStore.tutup, 1800)
    return hasil
  } catch (e) {
    ubah({ fase: 'gagal', pesan: pesanGalat(e) })
    throw e
  }
}

function laporKe(persen: number, tahap?: string) {
  if (keadaan.fase !== 'proses') return
  ubah({ persen: Math.max(keadaan.persen, Math.min(99, persen)), ...(tahap ? { tahap } : {}) })
}

/** Lapor bertahap untuk n butir (foto, halaman) dalam rentang persen [dari, sampai]. */
export function laporBertahap(lapor: Lapor, dari: number, sampai: number, n: number, teks: (i: number, n: number) => string) {
  return (i: number) => lapor(dari + ((sampai - dari) * i) / Math.max(1, n), teks(i, n))
}

/** Satu langkah dengan jeda singkat agar persentase sempat tergambar sebelum pekerjaan sinkron berikutnya. */
export async function tahap(lapor: Lapor, persen: number, teks: string) {
  lapor(persen, teks)
  await jeda()
}

/** Muat isi foto (maks. 4 sekaligus) untuk disisipkan ke file; progres naik per foto dalam [dari, sampai]. Foto gagal = ''. */
export async function muatFoto<P extends { id: string }>(fotos: P[], ambil: (p: P) => Promise<string>, lapor: Lapor, dari: number, sampai: number) {
  const out: Record<string, string> = {}
  const antre = [...fotos]
  let selesai = 0
  const kerja = async () => {
    for (let p = antre.shift(); p; p = antre.shift()) {
      out[p.id] = await ambil(p).catch(() => '')
      selesai++
      lapor(dari + ((sampai - dari) * selesai) / fotos.length, `Memuat foto ${selesai}/${fotos.length}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, fotos.length) }, kerja))
  return out
}
