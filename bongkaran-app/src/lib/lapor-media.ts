/**
 * Foto & video bercap waktu dari kamera Lapor (tombol tengah bar bawah), diteruskan ke form laporan
 * insiden / near miss / kerusakan yang dipilih. Disimpan di memori saja sampai form mengunggahnya.
 */
export interface MediaLapor {
  id: string
  jenis: 'foto' | 'video'
  blob: Blob
  url: string
  /** Cap waktu saat diambil, mis. "17/10/2026 15:10:02 WIB". */
  waktu: string
}

let titipan: MediaLapor[] = []

export const titipMedia = (m: MediaLapor[]) => {
  titipan = m
}

/** Ambil sekali (form memakainya lalu titipan dikosongkan). */
export function ambilMedia() {
  const m = titipan
  titipan = []
  return m
}

export const lihatMedia = () => titipan
