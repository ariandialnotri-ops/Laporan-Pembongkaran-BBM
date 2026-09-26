import type { QQStatus, ReportStatus } from '@/data/mock'

export type Tahap = 'bongkaran' | 'quality' | 'selesai'

export interface Bongkaran {
  id: string
  created_at: string
  spbu: string
  waktu_bongkar: string
  no_polisi: string
  produk: string
  volume_do: number
  volume_realisasi: number
  catatan: string | null
  foto_do_path: string | null
  suhu_observasi: number | null
  density_observasi: number | null
  density_koreksi: number | null
  pengawas: string | null
  tera_bejana: number | null
  meter_awal: number | null
  meter_akhir: number | null
  foto_tera_path: string | null
  tahap: Tahap
  qq_status: QQStatus
  qq_catatan: string | null
}

export type BongkaranBaru = Pick<
  Bongkaran,
  'spbu' | 'waktu_bongkar' | 'no_polisi' | 'produk' | 'volume_do' | 'volume_realisasi' | 'catatan' | 'foto_do_path'
>

export type JenisLaporan = 'berita_acara' | 'harian'

export interface Laporan {
  id: string
  created_at: string
  judul: string
  jenis: JenisLaporan
  spbu: string
  status: ReportStatus
  bongkaran_id: string | null
}
