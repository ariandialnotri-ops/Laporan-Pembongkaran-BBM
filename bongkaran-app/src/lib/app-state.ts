import { createContext, useContext, useEffect } from 'react'
import type { Backend, SessionInfo } from '@/lib/backend'
import type { DailyRecord } from '@/lib/daily'
import type { Role } from '@/lib/roles'
import type { Plan, ReportSummary, Rules, Settings } from '@/lib/sop'

export type SessionStatus = 'loading' | 'login' | 'nomember' | 'ready' | 'error'

export interface AppState {
  backend: Backend
  status: SessionStatus
  statusMessage: string
  session: SessionInfo
  /** Peran efektif (mode lokal = ABH). */
  role: Role
  /** ABH (atau mode lokal): kelola anggota, pengaturan SPBU, dan data utama APAR. */
  isAdmin: boolean
  /** ABH atau pengawas: hapus laporan/plan, buka ulang laporan anomali. */
  canManage: boolean
  /** Peran ini boleh membuka halaman tersebut. */
  can: (path: string) => boolean
  displayName: string
  initials: string

  loaded: boolean
  settings: Settings
  rules: Rules
  updateSettings: (patch: Partial<Settings>) => void

  plans: Plan[]
  savePlan: (plan: Plan) => Promise<void>
  deletePlan: (plan: Plan) => Promise<void>

  reports: ReportSummary[]
  upsertSummary: (summary: ReportSummary) => void
  removeSummary: (id: string) => void
  /** Catatan stok shift & Q&Q harian 120 hari terakhir. */
  daily: DailyRecord[]
  saveDaily: (rec: DailyRecord) => Promise<void>
  deleteDaily: (rec: DailyRecord) => Promise<void>
  /** LO yang sudah dipakai laporan lain: loId -> ringkasan laporan. */
  usedLoIds: Map<string, ReportSummary>
  refresh: () => Promise<void>
  /** Muat ulang data dari server bila terakhir dimuat lebih dari 10 detik lalu. */
  sync: () => void

  retrySession: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  canDeleteReport: (r: Pick<ReportSummary, 'status' | 'createdBy'>) => boolean
}

export const AppContext = createContext<AppState | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp harus dipakai di dalam AppProvider')
  return ctx
}

/** Ambil data terbaru dari server saat halaman dibuka (data dari perangkat lain). */
export function useSyncOnOpen() {
  const { sync } = useApp()
  useEffect(() => sync(), [sync])
}
