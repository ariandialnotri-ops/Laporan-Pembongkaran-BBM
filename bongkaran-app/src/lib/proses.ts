import type { Backend } from '@/lib/backend/types'

/**
 * Pelacak kirim / unggah / hapus data untuk lembar proses global ("Memproses…" → "Berhasil!").
 * Setiap pemanggilan metode tulis backend dihitung; panggilan berurutan dalam satu aksi
 * (mis. unggah 3 foto lalu simpan) digabung menjadi satu sesi.
 */
export type JenisProses = 'unggah' | 'simpan' | 'hapus'

const PANTAU: Partial<Record<keyof Backend, JenisProses>> = {
  uploadPhoto: 'unggah',
  saveSettings: 'simpan',
  saveSettingsTerbatas: 'simpan',
  saveTank: 'simpan',
  savePlan: 'simpan',
  saveReport: 'simpan',
  saveDaily: 'simpan',
  saveOps: 'simpan',
  kirimWbs: 'simpan',
  updateWbs: 'simpan',
  saveGts: 'simpan',
  saveAir: 'simpan',
  savePetty: 'simpan',
  saveCatatan: 'simpan',
  addMember: 'simpan',
  setMemberRole: 'simpan',
  createAccount: 'simpan',
  resetPassword: 'simpan',
  changePassword: 'simpan',
  buatSpbu: 'simpan',
  deleteTank: 'hapus',
  deletePlan: 'hapus',
  deleteReport: 'hapus',
  deleteDaily: 'hapus',
  deleteOps: 'hapus',
  deleteGts: 'hapus',
  deleteAir: 'hapus',
  deletePetty: 'hapus',
  deleteCatatan: 'hapus',
  deletePhoto: 'hapus',
  removeMember: 'hapus',
}

export interface KeadaanProses {
  fase: 'diam' | 'proses' | 'sukses'
  /** Jenis yang terjadi di sesi ini. */
  jenis: Set<JenisProses>
  /** Jenis operasi yang sedang berjalan (untuk teks "Mengunggah…" / "Menghapus…"). */
  aktif: JenisProses | null
  /** Jumlah foto/video yang selesai diunggah di sesi ini. */
  unggah: number
  /** Sesi berakhir dengan galat: lembar ditutup, pesan galat ditangani halaman. */
  gagal: boolean
  /** Proses sudah berjalan >0,4 detik: animasi "Memproses…" layak ditampilkan (proses singkat langsung sukses). */
  tampil: boolean
}

const KOSONG: KeadaanProses = { fase: 'diam', jenis: new Set(), aktif: null, unggah: 0, gagal: false, tampil: false }
let keadaan = KOSONG
const pendengar = new Set<() => void>()
let berjalan = 0
let senyap = 0
let tundaSelesai: ReturnType<typeof setTimeout> | null = null
let tundaTampil: ReturnType<typeof setTimeout> | null = null

const ubah = (patch: Partial<KeadaanProses>) => {
  keadaan = { ...keadaan, ...patch }
  pendengar.forEach((f) => f())
}

export const prosesStore = {
  subscribe(f: () => void) {
    pendengar.add(f)
    return () => pendengar.delete(f)
  },
  get: () => keadaan,
  tutup: () => {
    if (tundaTampil) clearTimeout(tundaTampil)
    tundaTampil = null
    keadaan = KOSONG
    pendengar.forEach((f) => f())
  },
}

/** Jalankan penyimpanan latar (mis. autosave draf) tanpa memunculkan lembar proses. */
export function diam<T>(fn: () => T): T {
  senyap++
  try {
    return fn()
  } finally {
    senyap--
  }
}

function mulai(jenis: JenisProses) {
  if (tundaSelesai) clearTimeout(tundaSelesai)
  tundaSelesai = null
  berjalan++
  const baru = keadaan.fase !== 'proses'
  const set = new Set(baru ? [] : keadaan.jenis)
  set.add(jenis)
  ubah({ fase: 'proses', jenis: set, aktif: jenis, ...(baru ? { unggah: 0, gagal: false, tampil: false } : {}) })
  if (baru) {
    if (tundaTampil) clearTimeout(tundaTampil)
    tundaTampil = setTimeout(() => {
      tundaTampil = null
      if (keadaan.fase === 'proses') ubah({ tampil: true })
    }, 400)
  }
}

function selesai(jenis: JenisProses, ok: boolean) {
  berjalan = Math.max(0, berjalan - 1)
  ubah({ unggah: keadaan.unggah + (ok && jenis === 'unggah' ? 1 : 0), gagal: keadaan.gagal || !ok })
  if (berjalan > 0) return
  // Beri jeda singkat: aksi yang terdiri dari beberapa panggilan berurutan tetap satu sesi.
  tundaSelesai = setTimeout(() => {
    tundaSelesai = null
    if (berjalan > 0) return
    if (keadaan.gagal) prosesStore.tutup()
    else ubah({ fase: 'sukses', aktif: null })
  }, 350)
}

/** Bungkus backend: metode tulis dilacak, metode lain diteruskan apa adanya. */
export function pantau(b: Backend): Backend {
  const hasil = { ...b }
  for (const [nama, jenis] of Object.entries(PANTAU) as [keyof Backend, JenisProses][]) {
    const asli = b[nama] as unknown as (...a: unknown[]) => Promise<unknown>
    if (typeof asli !== 'function') continue
    ;(hasil as Record<string, unknown>)[nama] = (...args: unknown[]) => {
      if (senyap > 0) return asli.apply(b, args)
      mulai(jenis)
      let p: Promise<unknown>
      try {
        p = Promise.resolve(asli.apply(b, args))
      } catch (e) {
        selesai(jenis, false)
        throw e
      }
      p.then(
        () => selesai(jenis, true),
        () => selesai(jenis, false),
      )
      return p
    }
  }
  return hasil
}
