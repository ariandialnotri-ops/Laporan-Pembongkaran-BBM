import type { DailyRecord } from '@/lib/daily'
import type { Photo, Plan, Report, ReportSummary, Settings } from '@/lib/sop'

import type { Role } from '@/lib/roles'

export type { Role }

export interface Member {
  user_id: string
  email: string
  nama: string | null
  role: Role
  created_at: string
}

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

  getSettings(): Promise<Partial<Settings> | null>
  saveSettings(settings: Settings): Promise<void>

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
  /** ABH membuat akun login baru (langsung aktif) dan mendaftarkannya sebagai anggota. */
  createAccount(email: string, password: string, nama: string, role: Role): Promise<void>
  /** ABH mengatur ulang kata sandi anggota. */
  resetPassword(userId: string, password: string): Promise<void>
  /** Pengguna mengganti kata sandinya sendiri. */
  changePassword(password: string): Promise<void>
}
