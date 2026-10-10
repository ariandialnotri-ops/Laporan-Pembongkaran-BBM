import type { DailyRecord } from '@/lib/daily'
import type { Photo, Plan, Report, ReportSummary, Settings } from '@/lib/sop'
import type { TankDef } from '@/lib/tank'

import type { Role } from '@/lib/roles'

export type { Role }

export interface Member {
  user_id: string
  email: string
  nama: string | null
  role: Role
  spbu_id: string | null
  created_at: string
}

/** Satu SPBU (unit bisnis). Nama & kode mengikuti Identitas SPBU. */
export interface Spbu {
  id: string
  kode: string | null
  nama: string
}

/** Ringkasan satu SPBU untuk dashboard Unit Bisnis ABH. */
export interface RingkasanUnit {
  spbuId: string
  kode: string | null
  nama: string
  identitasLengkap: boolean
  tangki: number
  anggota: number
  pengawas: number
  bongkaranBulan: number
  anomaliBulan: number
  draft: number
  /** Jumlah shift yang sudah uji Q&Q, 7 hari terakhir (lama ke baru). */
  qq7Hari: number[]
  stokHariIni: number
  aparUnit: number
  aparCekBulan: number
  insidenTerbuka: number
  terakhirAktif: string | null
}

export type SettingsTerbatas = Pick<Settings, 'namaSpbu' | 'kodeSpbu' | 'alamatSpbu' | 'jumlahPulau' | 'jumlahDispenser' | 'apar' | 'apab' | 'aparArea' | 'soldTo' | 'shipTo'>

export interface SessionInfo {
  user: { id: string; email: string } | null
  /** null = login berhasil tetapi belum terdaftar sebagai anggota. */
  role: Role | null
  nama: string | null
}

/**
 * Satu antarmuka untuk dua penyimpanan: Supabase (data bersama, wajib login)
 * dan lokal (IndexedDB perangkat ini, tanpa login).
 */
export interface Backend {
  mode: 'local' | 'supabase'
  getSession(): Promise<SessionInfo>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  /** SPBU yang boleh diakses: tempat bertugas, atau semua unit bisnis yang dikendalikan ABH. */
  listSpbu(): Promise<Spbu[]>
  /** SPBU aktif: semua data di bawah ini dibaca/ditulis untuk SPBU ini. */
  pilihSpbu(id: string): void
  /** ABH menambah unit bisnis baru; mengembalikan id-nya. */
  buatSpbu(nama: string, kode: string): Promise<string>
  /** Ringkasan semua SPBU yang dikendalikan (dashboard Unit Bisnis). */
  ringkasanUnit(hariIni: string): Promise<RingkasanUnit[]>

  getSettings(): Promise<Partial<Settings> | null>
  saveSettings(settings: Settings): Promise<void>
  /** Sebagian pengaturan yang boleh diubah pengawas: identitas SPBU, data utama APAR/APAB & area, Sold To, Ship To. */
  saveSettingsTerbatas(data: SettingsTerbatas): Promise<void>

  /** Database tangki SPBU aktif. */
  listTanks(): Promise<TankDef[]>
  saveTank(tank: TankDef): Promise<void>
  deleteTank(id: string): Promise<void>

  listPlans(): Promise<Plan[]>
  savePlan(plan: Plan): Promise<void>
  deletePlan(id: string): Promise<void>

  listReports(): Promise<ReportSummary[]>
  getReport(id: string): Promise<Report | null>
  saveReport(report: Report, summary: ReportSummary): Promise<void>
  deleteReport(id: string): Promise<void>

  /** Foto sudah dikompres; mode Supabase langsung mengunggah blob tanpa menyimpan salinan di memori. */
  /** Catatan harian (stok shift, Q&Q harian) sejak tanggal tertentu. */
  listDaily(sinceIso: string): Promise<DailyRecord[]>
  saveDaily(rec: DailyRecord): Promise<void>
  /** Inspeksi APAR/APAB pada rentang tanggal (untuk kalender kepatuhan setahun, di luar 120 hari terakhir). */
  listApar(fromIso: string, toIso: string): Promise<DailyRecord[]>
  deleteDaily(id: string): Promise<void>

  uploadPhoto(reportId: string, blob: Blob, name: string): Promise<Photo>
  deletePhoto(photo: Photo): Promise<void>
  /** URL tampilan thumbnail per id foto (mode Supabase). */
  signedUrls(photos: Photo[]): Promise<Record<string, string>>
  /** Isi foto sebagai dataURL, untuk PDF/JPG. */
  photoDataUrl(photo: Photo): Promise<string>

  listMembers(): Promise<Member[]>
  addMember(email: string, nama: string, role: Role): Promise<void>
  setMemberRole(userId: string, role: Role): Promise<void>
  removeMember(userId: string): Promise<void>
  /** ABH membuat akun login baru (langsung aktif) dan mendaftarkannya sebagai anggota SPBU aktif. */
  createAccount(email: string, password: string, nama: string, role: Role): Promise<void>
  /** ABH mengatur ulang kata sandi anggota. */
  resetPassword(userId: string, password: string): Promise<void>
  /** Pengguna mengganti kata sandinya sendiri. */
  changePassword(password: string): Promise<void>
}
