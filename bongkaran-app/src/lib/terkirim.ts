import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/** Isi halaman "Data sudah terkirim" setelah sebuah form dikirim. */
export interface InfoTerkirim {
  /** Judul, mis. "Stok awal Shift 1 terkirim". */
  judul: string
  /** Kalimat pendek di bawah judul. */
  detail?: string
  /** Ringkasan data yang dikirim: [label, nilai]. */
  baris?: [string, string][]
  /** Hasil perlu perhatian (mis. di luar toleransi): ikon & warna oranye. */
  peringatan?: string
  /** Tombol lanjutan, mis. isi shift lain / lihat riwayat. */
  aksi?: { to: string; label: string }[]
}

/**
 * Pindah ke halaman Terkirim. `replace` supaya tombol kembali tidak membuka form yang sudah dikirim.
 * Panggil `guard.bypass()` lebih dulu bila form memakai useLeaveGuard.
 */
export function useKeTerkirim() {
  const navigate = useNavigate()
  return useCallback((info: InfoTerkirim) => navigate('/terkirim', { replace: true, state: info }), [navigate])
}
