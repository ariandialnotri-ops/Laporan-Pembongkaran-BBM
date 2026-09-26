export type QQStatus = 'sesuai' | 'perhatian' | 'belum'

export interface Produk {
  id: string
  name: string
  /** Standar density @15°C, kg/m³ — placeholder values, confirm with the spec sheet. */
  densityMin: number
  densityMax: number
}

export const produkList: Produk[] = [
  { id: 'pertalite', name: 'Pertalite', densityMin: 715, densityMax: 770 },
  { id: 'pertamax', name: 'Pertamax', densityMin: 715, densityMax: 770 },
  { id: 'pertamax-turbo', name: 'Pertamax Turbo', densityMin: 715, densityMax: 770 },
  { id: 'biosolar', name: 'Biosolar', densityMin: 815, densityMax: 880 },
  { id: 'pertamina-dex', name: 'Pertamina Dex', densityMin: 815, densityMax: 860 },
]

export function cariProduk(id: string) {
  return produkList.find((p) => p.id === id) ?? produkList[0]
}

/** Toleransi selisih bejana ukur 20 L terhadap meter pompa, dalam persen. */
export const TOLERANSI_TERA_PERSEN = 0.5

/** Toleransi selisih volume DO terhadap realisasi — placeholder, sesuaikan kebijakan. */
export const TOLERANSI_BONGKAR_PERSEN = 0.5

export interface ProductStatus {
  id: string
  name: string
  status: QQStatus
  note: string
}

export const productStatuses: ProductStatus[] = [
  { id: 'pertalite', name: 'Pertalite', status: 'sesuai', note: 'Sesuai' },
  { id: 'pertamax', name: 'Pertamax', status: 'sesuai', note: 'Sesuai' },
  { id: 'pertamax-turbo', name: 'Pertamax Turbo', status: 'perhatian', note: 'Cek Density' },
  { id: 'biosolar', name: 'Biosolar', status: 'sesuai', note: 'Sesuai' },
  { id: 'pertamina-dex', name: 'Pertamina Dex', status: 'belum', note: 'Belum Input' },
]

export interface UnloadingEntry {
  id: string
  product: string
  plate: string
  time: string
  volumeDo: number
  volumeReal: number
  qqStatus: QQStatus
  qqNote: string
}

export const recentUnloadings: UnloadingEntry[] = [
  { id: '1', product: 'Pertalite', plate: 'L 9021 XZ', time: 'Hari ini, 07.40', volumeDo: 8000, volumeReal: 7992, qqStatus: 'sesuai', qqNote: 'Q&Q Sesuai' },
  { id: '2', product: 'Biosolar', plate: 'L 8843 YA', time: 'Hari ini, 06.15', volumeDo: 16000, volumeReal: 16000, qqStatus: 'sesuai', qqNote: 'Q&Q Sesuai' },
  { id: '3', product: 'Pertamax Turbo', plate: 'L 7712 RB', time: 'Kemarin, 16.20', volumeDo: 5000, volumeReal: 4968, qqStatus: 'perhatian', qqNote: 'Density Cek Ulang' },
]

export const todaySummary = {
  totalLiter: 24500,
  mobilTangki: 5,
  spbu: 3,
  qqSesuai: 3,
  qqTotal: 5,
}

export type ReportStatus = 'terkirim' | 'menunggu' | 'draft'

export interface ReportEntry {
  id: string
  title: string
  spbu: string
  date: string
  status: ReportStatus
}

export const recentReports: ReportEntry[] = [
  { id: '1', title: 'BA Bongkaran · Pertalite', spbu: 'SPBU Kediri 01', date: '25 Sep 2026', status: 'terkirim' },
  { id: '2', title: 'Laporan Harian · Shift 1', spbu: 'SPBU Kediri 01', date: '25 Sep 2026', status: 'terkirim' },
  { id: '3', title: 'BA Bongkaran · Pertamax Turbo', spbu: 'SPBU Kediri 01', date: '24 Sep 2026', status: 'menunggu' },
  { id: '4', title: 'Laporan Harian · Shift 2', spbu: 'SPBU Kediri 01', date: '23 Sep 2026', status: 'draft' },
]

export interface CalendarDay {
  label: string
  date: number
  status: 'sesuai' | 'catatan' | 'belum'
  isToday?: boolean
}

export const calendarWeek: CalendarDay[] = [
  { label: 'Sen', date: 22, status: 'sesuai' },
  { label: 'Sel', date: 23, status: 'sesuai' },
  { label: 'Rab', date: 24, status: 'catatan' },
  { label: 'Kam', date: 25, status: 'sesuai' },
  { label: 'Jum', date: 26, status: 'sesuai', isToday: true },
  { label: 'Sab', date: 27, status: 'belum' },
  { label: 'Min', date: 28, status: 'belum' },
]

export const pengawasList = [
  { id: 'andi', name: 'Andi Wirawan', shift: 'Pengawas Shift 1' },
  { id: 'sinta', name: 'Sinta Marlina', shift: 'Pengawas Shift 2' },
]

export const currentUser = {
  name: 'Rian',
  initials: 'RI',
  role: 'Area Business Head',
  coverage: '12 SPBU · Wilayah Kediri & Nganjuk',
  spbu: 'SPBU Kediri 01',
  spbuAddress: 'Jl. Dhoho No.12',
  greeting: 'Selamat Pagi',
  today: 'Jumat, 26 September 2026',
  stats: {
    validated: 312,
    complianceRate: '97%',
    reportsThisMonth: 28,
  },
}
